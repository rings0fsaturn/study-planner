# Server-Side Code-Execution Sandbox Comparison

_Research for the study-planner "coding practice / assessment" feature._
_Date: 2026-07-31. Stack: Vite/React 19 SPA + FastAPI "Intelligence Service" (Python 3.12) + Supabase; frontend on Vercel, Python service containerized (`services/intelligence/Dockerfile`); dev via Docker/Colima._

The client-side tier (Pyodide + native JS) is already decided for instant feedback. This
document evaluates the **authoritative server-side runner** used for grading and for
languages Pyodide cannot run.

## Executive Summary

- **Recommendation: self-host Judge0 CE** as a separate container alongside the FastAPI
  Intelligence Service. It is purpose-built for exactly this problem (accept untrusted
  source + stdin, compare against `expected_output`, return an Accepted / Wrong Answer /
  TLE / Compilation Error verdict), speaks a plain HTTP JSON API our FastAPI service can
  call, supports 90+ languages, and enforces per-run CPU/wall/memory/process limits via
  `isolate`. [Judge0 repo](https://github.com/judge0/judge0), [Judge0 CE docs](https://ce.judge0.com/)
- **Judge0's grading model is the decisive fit**: `expected_output` comparison and numeric
  `status` verdicts (3=Accepted, 4=Wrong Answer, 5=Time Limit Exceeded, 6=Compilation
  Error) are first-class, so we do not have to build a test harness / diff layer ourselves. [Judge0 CE docs](https://ce.judge0.com/)
- **Piston is the strong runner-up** and lighter to run, but it is an _execution_ engine,
  not a _grader_ - no expected-output comparison, no per-language grading verdicts, and its
  hosted public API is **no longer freely available (as of Feb 15, 2026)**. Choose it if we
  want a smaller footprint and are willing to write the diff/verdict layer in FastAPI. [Piston repo](https://github.com/engineer-man/piston)
- **A self-managed container/gVisor/nsjail/Firecracker runner is not worth it for a capstone.**
  It is the most flexible and the only way to get bespoke isolation, but it means we own the
  entire security surface (namespaces, cgroups, seccomp, fork-bomb/network/disk defenses),
  the queue, and the per-language toolchain images - work that Judge0/Piston already did and
  hardened. Recommend only as a documented "considered and rejected" alternative.
- **Cloudflare Sandbox SDK is a hard platform mismatch for this stack.** It runs only as a
  Durable Object binding _inside a Cloudflare Worker_; you cannot call it as a normal HTTP
  service from our containerized FastAPI service without adopting Cloudflare Workers +
  Containers as a deployment target. It is also **Beta** (APIs may change before v1.0). Good
  tech, wrong platform for us. [sandbox-sdk repo](https://github.com/cloudflare/sandbox-sdk)
- **Security bottom line**: whichever we pick, the untrusted-code must-haves (network off,
  CPU + wall + memory + process caps, output caps, ephemeral filesystem, non-root user, no
  host mounts) must be verified. Judge0 and Piston both provide these; a self-managed runner
  requires us to build them.
- **Cost bottom line**: self-hosted Judge0/Piston = only our own compute (one extra
  container). Judge0 hosted is ~€27-107/month by daily-submission tier. Cloudflare
  Containers require a $5/mo Workers Paid plan plus metered vCPU-s / GiB-s / egress.

## Comparison Table

| Dimension | Judge0 (self-host) | Judge0 (hosted/RapidAPI) | Piston (self-host) | Self-managed container runner | Cloudflare Sandbox SDK |
|---|---|---|---|---|---|
| Languages | 90+ | 90+ | ~80 | Whatever images you build | Python + JS interpreter; any via `exec` in the container |
| Grading built in (expected_output + verdict) | **Yes** | **Yes** | No (execute only) | No (build it) | No (build it) |
| stdin / args | Yes (`stdin`) | Yes | Yes (`stdin`, `args`) | You wire it | Via `exec`/interpreter |
| Isolation | `isolate` (namespaces + cgroups + chroot, seccomp via libseccomp) | Managed by Judge0 | `isolate` in Docker (namespaces, chroot, cgroups, unpriv users) | Your choice (Docker/gVisor/nsjail/Firecracker) | Per-instance **VM** (each sandbox its own VM) |
| Resource limits | CPU/wall/mem/stack/procs/output all configurable | Same, provider-set | CPU/wall/mem/procs/output configurable | You implement | Container/VM limits; not per-run tunable the same way |
| Network isolation | Off by default | Off | **Off by default** | You configure | Isolated; egress possible |
| Self-host infra | Docker Compose: web + worker + Postgres + Redis | n/a | Docker + Compose, Node ≥15, **cgroup v2** | Full ops: orchestration, images, queue, security | n/a (runs on CF) |
| How we call it | HTTP JSON API | HTTP JSON API | HTTP JSON API | HTTP you build | JS SDK from a Worker binding (not plain HTTP) |
| Latency | Warm ms-scale; async queue | Network + queue | Warm ms-scale | Depends on cold-start strategy | Container cold start ~1-3 s |
| License | **GPL-3.0** | Commercial API | **MIT** | Your code | Apache-2.0 (Beta) |
| Fit with our FastAPI/Vercel/Docker stack | **Excellent** (extra container) | Good (external dependency) | Good (extra container, add grader) | Poor (heavy ops) | **Mismatch** (needs CF Workers) |

## Option 1 - Judge0

**What it is.** An open-source "online judge" / code-execution system, established 2016,
current CE line **v1.13.1**, GPL-3.0. Two flavors: **Judge0 CE** (`master`) and **Judge0
Extra CE** (`extra`), differing mostly in languages. [Judge0 repo](https://github.com/judge0/judge0)

**Languages & test harness.** 90+ languages, multi-file "projects" supported. Grading is
native: submit `source_code` + `language_id` + `stdin` + `expected_output`; Judge0 runs and
compares `expected_output` against `stdout` (skipped if null) and returns a `status` object.
Grading-relevant status IDs: **3 Accepted, 4 Wrong Answer, 5 Time Limit Exceeded, 6
Compilation Error**. This is the exact verdict model an assessment feature needs - no diff
layer to build. [Judge0 CE docs](https://ce.judge0.com/)

**Isolation & limits.** Uses **`isolate`** (from the IOI contest world) for sandboxing:
Linux **namespaces + control groups + chroot**, with resource caps and syscall filtering
(built against libcap, libseccomp, libsystemd). `isolate` is explicitly "a sandbox built to
safely run untrusted executables." [ioi/isolate](https://github.com/ioi/isolate) Per-submission limits (default / max): `cpu_time_limit`
2 s / 15 s, `cpu_extra_time` 0.5 s / 2 s, `wall_time_limit` 5 s / 20 s, `memory_limit`
128000 KB / 256000 KB, `stack_limit` 64000 KB / 128000 KB, `max_file_size` 1024 KB / 4096 KB,
`number_of_runs` 1 / 20, `max_processes_and_or_threads` 60 / 120. Docs advise using
`cpu_time_limit` as the primary limit with a higher `wall_time_limit` as a sleep safeguard. [Judge0 CE docs](https://ce.judge0.com/)
Note: `isolate` needs a privileged host setup (cgroups, capabilities) - relevant under
Colima/containerized hosts.

**Self-hosting effort & ops.** Runs as two roles - **web** (API) and **worker** (executes),
splittable across hosts - backed by **PostgreSQL** and **Redis**, deployed via the provided
`docker-compose.yml`. Async by design: create a submission, poll by token or use webhooks;
`wait=true` exists but docs "do not recommend" it (does not scale) and it is disabled on the
official instance. Batch endpoint `POST /submissions/batch`. Config via `judge0.conf`
(`max_queue_size` default 100, `enable_submission_delete` default false). [Judge0 CE docs](https://ce.judge0.com/) This is more
moving parts than Piston, but all standard containers we already run under Docker/Colima.

**Hosted / managed.** Available on RapidAPI, and Judge0 sells plans directly: **Pro €27/mo
(2000 submissions/day), Ultra €54/mo (5000/day), Mega €107/mo (10000/day)**, €0.001 per
extra submission, community+email support. [judge0.com](https://judge0.com/) Good for a demo without ops, but adds an
external network dependency and recurring cost.

**Latency/throughput.** Warm execution is ms-to-low-seconds (dominated by the limits above);
throughput scales by adding workers; the queue (`max_queue_size`, `/workers` metrics) gives
backpressure visibility.

**Fit.** Our FastAPI service POSTs JSON to Judge0 and polls/receives a webhook - trivial
with `httpx`. Deploy Judge0 as its own container(s) next to `services/intelligence`. **Caveat:
GPL-3.0** - we call it over HTTP as a separate service (not linked into our code), which
keeps our app's licensing unaffected, but we should not fork/embed its source into our
GPL-incompatible code.

## Option 2 - Piston (EngineerMan)

**What it is.** A high-performance, general-purpose code execution engine, **MIT** licensed,
~80 languages (awk → zig, plus many esoteric ones). [Piston repo](https://github.com/engineer-man/piston)

**Languages & harness.** `GET /api/v2/runtimes` lists languages/versions/aliases; `POST
/api/v2/execute` runs code with `language`, `version`, `files` (first file is main),
optional `stdin`, `args`, and timeout/memory overrides. Response has `run` (and `compile`
where relevant) with `stdout`, `stderr`, `code`, `signal`, `status` (`RE`, `TO`, `XX`...).
There is a WebSocket `/api/v2/connect` for interactive runs (self-host only). **No
expected-output comparison and no Accepted/Wrong-Answer verdict** - we would compare
`stdout` to expected output ourselves in FastAPI. [Piston repo](https://github.com/engineer-man/piston)

**Isolation & limits.** **`isolate` inside Docker** - Linux namespaces, chroot, multiple
unprivileged users, cgroups. Hardening: **outgoing network disabled by default**, max 256
processes, max 2048 files, temp space cleaned after each run, each submission runs as a
separate unprivileged user, misbehaving code is SIGKILLed. Configurable limits: compile
timeout 10000 ms, run timeout 3000 ms, memory limits -1 (unlimited) by default, stdout cap
1024 chars by default. [Piston repo](https://github.com/engineer-man/piston)

**Self-hosting effort & ops.** Lighter than Judge0: Docker + Docker Compose, Node ≥15,
**cgroup v2 enabled and cgroup v1 disabled**, API on port 2000; runtimes installed on demand
via the `ppman` CLI. No separate Postgres/Redis. [Piston repo](https://github.com/engineer-man/piston)

**Hosted availability.** The public `emkc.org` API is **no longer freely available as of Feb
15, 2026** - it now requires an authorization token (via Discord), granted only for
non-commercial, low-volume educational use. So for a real feature, **self-hosting is
effectively mandatory**. [Piston repo](https://github.com/engineer-man/piston)

**Fit.** Clean HTTP JSON API from FastAPI (`httpx`), synchronous execute call, smaller
footprint than Judge0. The trade-off is building the grading/verdict layer ourselves. MIT
license is the most permissive of the group.

## Option 3 - Self-managed container runner (Docker / gVisor / nsjail / Firecracker)

**What it is.** We build the runner: per-run ephemeral containers (or microVMs), our own
per-language images, our own queue, our own isolation policy. Isolation options range from
plain Docker (weak alone), to **gVisor** (user-space kernel, strong syscall interception),
**nsjail** (namespaces + seccomp-bpf, Google's lightweight jailer), or **Firecracker**
(microVMs, the strongest boundary, used by AWS Lambda).

**Languages & harness.** Unlimited in principle - anything we build an image for - but every
language, its compile/run wiring, stdin, and expected-output comparison is ours to implement
and maintain.

**Isolation & limits.** Fully bespoke and potentially the strongest (Firecracker/gVisor give
a real kernel/VM boundary). But we must correctly configure namespaces, cgroup CPU/mem caps,
seccomp profiles, read-only rootfs, network-none, PID/file limits, and fork-bomb/disk-fill
defenses - and get them right the first time, because this is untrusted code.

**Ops.** Highest by far: image build pipeline per language, an execution queue/worker pool,
autoscaling, cold-start warming, monitoring, and ongoing security patching. Under our
current Docker/Colima dev + containerized-service prod, this is a whole subsystem.

**Fit / verdict.** Maximum control, maximum cost and risk. For an M.Tech capstone that needs
robustness without reinventing a hardened judge, this is **not recommended** - Judge0/Piston
already encapsulate this exact work behind `isolate`. Keep it as the documented rejected
alternative (and note gVisor/Firecracker as what we _would_ use if we ever needed custom
runtimes at scale).

## Option 4 - Cloudflare Sandbox SDK (`@cloudflare/sandbox`)

**What it is.** An Apache-2.0, **Beta** SDK to "run untrusted code safely in isolated
containers" from a Cloudflare Workers app: exec commands, a code interpreter (Python + JS
with rich outputs), file R/W, background processes, git clone, and preview/tunnel URLs. [sandbox-sdk repo](https://github.com/cloudflare/sandbox-sdk)

**Isolation & limits.** Runs on **Cloudflare Containers**, where "each container instance
runs inside its own VM, which provides strong isolation from other workloads." Disk is
ephemeral; instances get SIGTERM then SIGKILL after 15 min; images must be `linux/amd64`.
Firecracker is not named in the docs - only "per-instance VM." [CF Containers platform details](https://developers.cloudflare.com/containers/platform-details/)

**Latency.** Container cold starts "often in the 1-3 second range," mitigated by pre-fetched
images and nearest-warm-location scheduling. [CF Containers platform details](https://developers.cloudflare.com/containers/platform-details/)

**Pricing.** Requires the **$5/mo Workers Paid** plan (Containers are N/A on Free). Metered:
**memory $0.0000025/GiB-s** (25 GiB-h/mo included), **CPU $0.000020/vCPU-s** (375
vCPU-min/mo included), **disk $0.00000007/GB-s** (200 GB-h/mo included), billed per 10 ms of
active run; plus Workers + Durable Object request charges and egress ($0.025/GB in NA/EU,
1 TB included). Instance types lite → standard-4 (1/16-4 vCPU, 256 MiB-12 GiB). [CF Containers pricing](https://developers.cloudflare.com/containers/pricing/)

**Fit / verdict.** **Hard mismatch.** It is consumed as a **Durable Object binding inside a
Worker** (`getSandbox(env.Sandbox, ...)`), not as a plain HTTP endpoint our containerized
FastAPI service can call. Adopting it means running (part of) the backend on Cloudflare
Workers + Containers - a new platform alongside Vercel + our Docker service - and building
the grading layer ourselves on top of a Beta API. Not aligned with this stack.

## Security Must-Haves for Untrusted Code (checklist)

Verify each of these for the chosen runner before it grades real submissions:

- [ ] **Network egress disabled by default** for the sandbox (Judge0: off; Piston: off by default).
- [ ] **CPU-time limit** per run (Judge0 `cpu_time_limit`; Piston run timeout).
- [ ] **Wall-time limit** as a sleep/hang safeguard, set higher than CPU limit (Judge0 `wall_time_limit`).
- [ ] **Memory limit** per run (Judge0 `memory_limit`; Piston memory limit - Piston default is unlimited, so **set it explicitly**).
- [ ] **Process/thread cap** to stop fork bombs (Judge0 `max_processes_and_or_threads`; Piston 256-proc cap).
- [ ] **Output size cap** to stop disk/log floods (Judge0 `max_file_size`; Piston stdout cap).
- [ ] **Ephemeral, isolated filesystem** wiped after each run; **no host bind-mounts**.
- [ ] **Non-root / unprivileged user** per execution (both use `isolate` unprivileged users).
- [ ] **Kernel-enforced isolation** (namespaces + cgroups + seccomp via `isolate`), not app-level checks.
- [ ] **Host has cgroups configured** for `isolate` (Piston needs **cgroup v2, v1 disabled**; verify under Colima).
- [ ] **Concurrency/queue backpressure** so a flood of submissions cannot exhaust the host (Judge0 `max_queue_size` + worker pool).
- [ ] **Timeouts + typed errors on our side** when calling the runner from FastAPI (align with `fetch-typed-error-normalization` rule for the client contract).
- [ ] **Runner runs as a separate service/container**, never in-process with the FastAPI app.

## Final Recommendation & Rationale (for this stack)

**Self-host Judge0 CE as a dedicated container next to the FastAPI Intelligence Service.**

1. **It is a grader, not just an executor.** `expected_output` comparison plus
   Accepted/Wrong-Answer/TLE/Compilation-Error verdicts are exactly what a coding-assessment
   feature emits, so we avoid building and hardening a diff/verdict layer. Piston would make
   us build that; the self-managed and Cloudflare options make us build both that _and_ the
   sandbox.
2. **It fits our deployment model.** A plain HTTP JSON API is called from FastAPI with
   `httpx` (async submit + poll/webhook), and it deploys as ordinary containers under the
   same Docker/Colima dev and containerized-prod story we already use for
   `services/intelligence`. No new platform (unlike Cloudflare).
3. **The isolation is real and battle-tested.** `isolate` gives kernel-level namespaces +
   cgroups + chroot + seccomp, used by international programming olympiads - stronger and
   more proven than anything we would hand-roll for a capstone.
4. **Cost is just our compute** - no per-submission SaaS fee, no Workers-Paid dependency.

**Watch-outs to plan for:** (a) **GPL-3.0** - keep Judge0 as a separate over-the-wire
service; do not embed/fork its source into our app code. (b) It needs **Postgres + Redis +
web + worker** containers - more moving parts than Piston. (c) `isolate` needs a properly
configured (privileged, cgroup-enabled) host - validate this under Colima early, following
the `docker-colima-setup` rule.

**Fallback:** if Judge0's footprint proves too heavy for the dev environment, drop to
**self-hosted Piston** (MIT, single service, cgroup v2 required) and implement the
expected-output comparison and verdict mapping in FastAPI.
