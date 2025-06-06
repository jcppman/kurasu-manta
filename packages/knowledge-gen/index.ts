import { WorkflowEngine } from './src/workflow-engine'
import { logger } from './utils'
import { workflowDefinition as minnaJp1 } from './workflow/minna-jp-1'

async function main() {
  const args = process.argv.slice(2)

  // Parse command line arguments
  const listResumes = args.includes('--list-resumes')
  const resumeIndex = args.findIndex((arg) => arg === '--resume')
  const resumeArg = resumeIndex !== -1 ? args[resumeIndex + 1] : undefined
  const resumeId = resumeArg ? Number.parseInt(resumeArg, 10) : null

  if (listResumes) {
    const engine = new WorkflowEngine()
    const resumes = await engine.getAvailableResumes()

    if (resumes.length === 0) {
      logger.info('No workflows available to resume.')
      return
    }

    logger.info('Available workflows to resume:')
    for (const resume of resumes) {
      const progressPercent =
        resume.totalSteps > 0 ? Math.round((resume.completedSteps / resume.totalSteps) * 100) : 0

      logger.info(`  ID: ${resume.id}`)
      logger.info(`  Workflow: ${resume.workflowName}`)
      logger.info(`  Status: ${resume.status}`)
      logger.info(`  Progress: ${resume.completedSteps}/${resume.totalSteps} (${progressPercent}%)`)
      logger.info(`  Current step: ${resume.currentStep || 'None'}`)
      logger.info(`  Created: ${resume.createdAt}`)
      logger.info(`  Updated: ${resume.updatedAt}`)
      logger.info('  ---')
    }
    return
  }

  if (resumeId) {
    logger.info(`Attempting to resume workflow with ID: ${resumeId}`)
    const engine = new WorkflowEngine()

    // Use new workflow API for resume
    await engine.runWorkflow(minnaJp1, { resumeId })
    logger.info('Workflow resumed and completed successfully')
    return
  }

  // Default workflow execution using new API
  const engine = new WorkflowEngine()
  await engine.runWorkflow(minnaJp1)

  logger.info('Workflow completed successfully.')
}

main().catch((error) => {
  logger.error('Workflow failed:', error)
  process.exit(1)
})
