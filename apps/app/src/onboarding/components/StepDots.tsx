interface StepDotsProps {
  currentStep: number
  reachedStep: number
  totalSteps: number
}

export function StepDots({ currentStep, reachedStep, totalSteps }: StepDotsProps) {
  return (
    <div className="stepdots">
      {Array.from({ length: totalSteps }, (_, i) => {
        const n = i + 1
        const isDone = n < currentStep
        const isReached = n <= reachedStep
        const isActive = n === currentStep
        const classes = ['stepdot']
        if (isDone || (isActive && isReached)) classes.push('done')
        if (isActive) classes.push('active')
        return <div key={n} className={classes.join(' ')} />
      })}
    </div>
  )
}
