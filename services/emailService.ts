export interface SendEmailRequest {
  recipients: string[];
  subject: string;
  body: string;
  userId?: string;
  fromName?: string;
}

export interface SendEmailResponse {
  success: boolean;
  error?: string;
}

const WORKER_URL = 'https://email-worker.study-llm.me';

export const sendEmail = async (request: SendEmailRequest): Promise<SendEmailResponse> => {
  try {
    const response = await fetch(`${WORKER_URL}/send-email-now`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(request),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      return {
        success: false,
        error: errorData.error || `HTTP error! status: ${response.status}`,
      };
    }

    const data = await response.json();
    return {
      success: data.success,
      error: data.error,
    };
  } catch (error: any) {
    console.error('Failed to send email:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
};
