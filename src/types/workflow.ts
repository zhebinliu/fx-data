export type StepType = 'SOURCE_DB' | 'TRANSFORM_VLOOKUP' | 'TRANSFORM_BATCH' | 'DESTINATION_FXCRM';

export interface WorkflowStep {
    id: string;
    type: StepType;
    name: string;
    description?: string;
    // Flexible configuration object that varies based on step type
    config: any;
}

export interface Workflow {
    id: string;
    name: string;
    description?: string;
    steps: WorkflowStep[];
    createdAt: string; // ISO Date string
    updatedAt: string; // ISO Date string
}
