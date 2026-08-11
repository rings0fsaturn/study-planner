# Study Planner Product Context

This context defines the learner-facing language for materials and their use in assessment and practice flows.

## Materials

**Material**:
A learner-owned source of study content or a contentless study reference that can support roadmaps, assessments, or practice.
_Avoid_: Resource, document, item

**Material Library**:
The dedicated collection where a learner browses, adds, reviews, archives, and reuses materials.
_Avoid_: Material store, content manager

**Ingestion**:
The process that turns a material source into usable study content and retrieval data.
_Avoid_: Import, processing

**Ready material**:
A material whose ingestion is complete enough to be selected for new assessment or practice generation.
_Avoid_: Active material, usable item

**Archived material**:
A material removed from new-selection surfaces while preserving its historical references and learner records.
_Avoid_: Deleted material, inactive material

**Material picker**:
The contextual multi-select surface used to choose ready materials for a new assessment or practice run.
_Avoid_: Material selector, source dropdown

**Contentless material**:
A material record that identifies a study subject without an ingested body of content.
_Avoid_: Empty material, placeholder material

## Assessment Review

**Assessment review**:
The learner-facing record of an assessment run that explains performance and mistakes after grading.
_Avoid_: Results dump, grade screen

**Question review**:
The feedback unit for one graded question, including its outcome, explanation, and applicable evidence.
_Avoid_: Answer card, item feedback

**Per-skill signal**:
A concise indication of how one graded question informs a skill, without presenting the full mastery projection.
_Avoid_: Mastery score, roadmap recommendation

**Attempt history**:
The preserved sequence of graded submissions for a question, with the latest attempt presented as the current review.
_Avoid_: Retry log, submission dump

**Partial result**:
An assessment review state where some questions have graded outcomes and other questions remain pending or unavailable.
_Avoid_: Failed assessment, incomplete grade
