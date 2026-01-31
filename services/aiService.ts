import { SurveySchema, ChatMessage } from '../types';

const API_URL = 'https://multi-model-worker.study-llm.me/chat';

const GENERATION_SYSTEM_INSTRUCTION = `You are a world-class Supply Chain Auditor and Survey Designer. 
Your goal is to create a professional, detailed supplier vetting survey based on the user's specific business context.

Rules:
1. The survey must be generated in 3 languages simultaneously: English (en), Simplified Chinese (sc), and Traditional Chinese (tc).
2. Structure the survey into logical sections (e.g., General Info, Production Capacity, Quality Control, Sustainability).
3. Use a mix of question types: 'short_text', 'long_text', 'single_choice' (radio), 'multiple_choice' (checkbox), 'number'.
4. Ensure questions are specific to the industry mentioned in the context.
5. The 'type' field in the JSON MUST be one of the exact strings listed in the prompt instructions.
6. Return ONLY valid JSON matching the specified schema. Do not include any other text.

JSON Schema:
{
  "title": { "en": "string", "sc": "string", "tc": "string" },
  "description": { "en": "string", "sc": "string", "tc": "string" },
  "sections": [
    {
      "id": "string",
      "title": { "en": "string", "sc": "string", "tc": "string" },
      "questions": [
        {
          "id": "string",
          "text": { "en": "string", "sc": "string", "tc": "string" },
          "type": "string (one of: short_text, long_text, single_choice, multiple_choice, number)",
          "placeholder": { "en": "string", "sc": "string", "tc": "string" } (optional),
          "required": "boolean",
          "options": [
            { 
              "label": { "en": "string", "sc": "string", "tc": "string" }, 
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
   - Maintain the integrity of the existing structure (IDs, languages, etc.) unless explicitly asked to change them.
   - If adding content, ensure it is multilingual (en, sc, tc).
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
export async function generateSurvey(userContext: string): Promise<SurveySchema> {
  const prompt = `Context: ${userContext}. Create a comprehensive survey for this supplier. Return ONLY the JSON.`;
  const messages: ChatMessage[] = [{ role: 'user', content: prompt }];
  return callAI<SurveySchema>(messages, GENERATION_SYSTEM_INSTRUCTION);
}

/**
 * Refines an existing survey based on user instruction and current state.
 */
export async function refineSurvey(currentSchema: SurveySchema, instruction: string, history: ChatMessage[] = []): Promise<{ updatedSurvey: SurveySchema | null, responseMessage: string }> {
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
  return callAI<{ updatedSurvey: SurveySchema | null, responseMessage: string }>(messages, REFINEMENT_SYSTEM_INSTRUCTION);
}

/**
 * Common AI call handler
 */
async function callAI<T>(messages: ChatMessage[], systemInstruction: string): Promise<T> {
  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'deepseek', 
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

    // Clean up markdown code blocks if present
    const jsonString = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    
    return JSON.parse(jsonString) as T;

  } catch (error) {
    console.error('AI Service Error:', error);
    throw error;
  }
}
