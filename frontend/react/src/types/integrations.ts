export interface NotionIntegration {
    access_token: string;
    workspace_id: string;
    database_id?: string;
}

export interface GoogleCalendarIntegration {
    access_token: string;
    refresh_token?: string;
    calendar_id?: string;
}

export interface UserIntegrations {
    notion?: NotionIntegration;
    google_calendar?: GoogleCalendarIntegration;
}

export interface AISettings {
    aiEnabled: boolean;
    integrations?: UserIntegrations;
}
