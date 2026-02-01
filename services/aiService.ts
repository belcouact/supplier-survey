import { SurveySchema, ChatMessage } from '../types';

const BASE_URL = 'https://multi-model-worker.study-llm.me';
const API_URL = `${BASE_URL}/chat`;

/**
 * Fetches the list of available AI models from the worker.
 */
export async function getAvailableModels(): Promise<string[]> {
  try {
    const response = await fetch(`${BASE_URL}/models`);
    if (!response.ok) {
      throw new Error(`Failed to fetch models: ${response.status}`);
    }
    const data = await response.json();
    return data.models || ['deepseek', 'gemini']; // Fallback
  } catch (error) {
    console.error('Error fetching models:', error);
    return ['deepseek', 'gemini']; // Fallback
  }
}

const GENERATION_SYSTEM_INSTRUCTION = `You are a world-class Supply Chain Auditor and Survey Designer. 
Your goal is to create a professional, detailed supplier vetting survey based on the user's specific business context.

Rules:
1. The survey content MUST be generated in English.
2. Structure the survey into logical sections.
3. CRITICAL: The FIRST section MUST be "Basic Information" and MUST include questions for:
   - Company Name
   - Department / Division
   - Contact Person Name
   - Contact Email
   - Factory Address
4. Use a mix of question types: 'short_text', 'long_text', 'single_choice' (radio), 'multiple_choice' (checkbox), 'number'.
5. Ensure questions are specific to the industry mentioned in the context.
6. The 'type' field in the JSON MUST be one of the exact strings listed in the prompt instructions.
7. Return ONLY valid JSON matching the specified schema. Do not include any other text.

JSON Schema:
{
  "title": "string",
  "description": "string",
  "sections": [
    {
      "id": "string",
      "title": "string",
      "questions": [
        {
          "id": "string",
          "text": "string",
          "type": "string (one of: short_text, long_text, single_choice, multiple_choice, number)",
          "placeholder": "string (optional)",
          "required": "boolean",
          "options": [
            { 
              "label": "string", 
              "value": "string" 
            }
          ]
        }
      ]
    }
  ]
}
`;

const REFINEMENT_SYSTEM_INSTRUCTION = `You are an expert Survey Editor.
Your goal is to MODIFY an existing survey JSON based on the user's instructions OR answer questions about the survey.

Rules:
1. You will receive the current "Survey JSON" and a "User Instruction".
2. If the user wants to modify the survey:
   - Apply the requested changes to the JSON structure.
   - Maintain the integrity of the existing structure (IDs, etc.) unless explicitly asked to change them.
   - Return the updated survey in the 'updatedSurvey' field.
3. If the user asks a question or the instruction is conversational (not a modification):
   - Set 'updatedSurvey' to null.
   - Provide a helpful answer in the 'responseMessage' field using Markdown formatting for better readability.
4. Return ONLY valid JSON matching the specified schema. Ensure the JSON is valid (escape characters properly).

JSON Schema:
{
  "updatedSurvey": { ...SurveySchema... } | null,
  "responseMessage": "string"
}
`;

/**
 * Generates a new survey based on a single user context string.
 */
export async function generateSurvey(userContext: string, model: string = 'deepseek'): Promise<SurveySchema> {
  const prompt = `Context: ${userContext}. Create a comprehensive survey for this supplier. Return ONLY the JSON.`;
  const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
  return callAI<SurveySchema>(messages, GENERATION_SYSTEM_INSTRUCTION, model);
}

/**
 * Refines an existing survey based on user instruction and current state.
 */
export async function refineSurvey(currentSchema: SurveySchema, instruction: string, history: ChatMessage[] = [], model: string = 'deepseek'): Promise<{ updatedSurvey: SurveySchema | null, responseMessage: string }> {
  // Convert history to a text summary to provide context without confusing the strict JSON system prompt
  const historyContext = history.length > 0 
    ? `Conversation History:\n${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}\n\n`
    : '';

  const prompt = `${historyContext}Current Survey JSON: ${JSON.stringify(currentSchema)}

User Instruction: ${instruction}

Analyze the instruction.
If it requires changing the survey, return { "updatedSurvey": ...full_updated_json..., "responseMessage": "I have updated the survey..." }.
If it is just a question or comment, return { "updatedSurvey": null, "responseMessage": "...your answer..." }.
Return ONLY the JSON object.`;
  
  const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
  return callAI<{ updatedSurvey: SurveySchema | null, responseMessage: string }>(messages, REFINEMENT_SYSTEM_INSTRUCTION, model);
}

const ANALYSIS_SYSTEM_INSTRUCTION = `You are an expert Supply Chain Auditor.
Your goal is to evaluate the provided survey results against the survey questions.
Provide a comprehensive analysis of the respondent's answers, highlighting strengths, weaknesses, and potential risks.

Rules:
1. You will receive the "Survey Template" (questions) and the "Survey Results" (answers).
2. Analyze the answers in the context of the questions.
3. Identify any red flags, compliance issues, or areas of concern.
4. Highlight positive aspects and compliance strengths.
5. Provide a summary recommendation (e.g., "Approved", "Conditional Approval", "Audit Required", "Rejected").
6. Format your response in clean, structured Markdown. Use headers, bullet points, and bold text for readability.
7. Do NOT return JSON. Return only the Markdown text.
`;

/**
 * Analyzes survey results using AI.
 */
export async function analyzeSurveyResults(template: any, results: any[], model: string = 'deepseek'): Promise<string> {
  const prompt = `Survey Template: ${JSON.stringify(template)}
  
  Survey Results: ${JSON.stringify(results)}
  
  Please provide a detailed analysis of these results.`;

  const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
  return callAI<string>(messages, ANALYSIS_SYSTEM_INSTRUCTION, model, false);
}

const RESULT_CHAT_SYSTEM_INSTRUCTION = `You are an expert Supply Chain Auditor and Data Analyst.
Your goal is to answer questions about a specific set of survey results.

Rules:
1. You will receive the "Survey Template" (questions) and the "Survey Results" (all answers).
2. Answer the user's questions based ONLY on the provided data.
3. If the answer is not in the data, state clearly that the information is missing.
4. Provide insights, trends, and comparisons where relevant.
5. Format your response in clean, structured Markdown.
6. Do NOT return JSON. Return only the Markdown text.
`;

/**
 * Chat with AI about the survey results.
 */
export async function chatWithSurveyResults(template: any, results: any[], userQuestion: string, history: ChatMessage[] = [], model: string = 'deepseek'): Promise<string> {
    const historyContext = history.length > 0 
    ? `Conversation History:\n${history.map(m => `${m.role.toUpperCase()}: ${m.content}`).join('\n')}\n\n`
    : '';

  const prompt = `Survey Template: ${JSON.stringify(template)}
  
  Survey Results: ${JSON.stringify(results)}
  
  ${historyContext}
  
  User Question: ${userQuestion}`;

  const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
  return callAI<string>(messages, RESULT_CHAT_SYSTEM_INSTRUCTION, model, false);
}

/**
 * Common AI call handler
 */
async function callAI<T>(messages: ChatMessage[], systemInstruction: string, model: string = 'deepseek', jsonMode: boolean = true): Promise<T> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: model, 
        messages: [
          { role: 'system', content: systemInstruction },
          ...messages
        ],
        stream: false
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    let content = '';
    if (data.choices && data.choices[0] && data.choices[0].message) {
      content = data.choices[0].message.content;
    } else if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
       content = data.candidates[0].content.parts[0].text;
    } else {
       console.log('Unknown response format:', data);
       throw new Error('Unknown response format from API');
    }

    if (!jsonMode) {
      return content as T;
    }

    // Extract JSON from the response
    let jsonString = content;
    
    // 1. Try to find markdown code block
    const codeBlockMatch = content.match(/```(?:json)?\s*([\s\S]*?)\s*```/);
    if (codeBlockMatch) {
      jsonString = codeBlockMatch[1];
    } else {
      // 2. If no code block, try to find the first '{' and last '}'
      const firstBrace = content.indexOf('{');
      const lastBrace = content.lastIndexOf('}');
      if (firstBrace !== -1 && lastBrace !== -1 && lastBrace > firstBrace) {
        jsonString = content.substring(firstBrace, lastBrace + 1);
      }
    }
    
    return JSON.parse(jsonString) as T;

  } catch (error) {
    console.error('AI Service Error:', error);
    throw error;
  }
}
