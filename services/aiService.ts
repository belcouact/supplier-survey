import { SurveySchema } from '../types';

const API_URL = 'https://multi-model-worker.study-llm.me/chat';

export async function generateSurvey(userContext: string, langName: string): Promise<SurveySchema> {
  const systemInstruction = `You are a world-class Supply Chain Auditor and Survey Designer. 
Your goal is to create a professional, detailed supplier vetting survey based on the user's specific business context.

Rules:
1. The survey must be in ${langName}.
2. Structure the survey into logical sections (e.g., General Info, Production Capacity, Quality Control, Sustainability).
3. Use a mix of question types: 'short_text', 'long_text', 'single_choice' (radio), 'multiple_choice' (checkbox), 'number'.
4. Ensure questions are specific to the industry mentioned in the context.
5. The 'type' field in the JSON MUST be one of the exact strings listed in the prompt instructions.
6. Return ONLY valid JSON matching the specified schema. Do not include any other text.

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
            { "label": "string", "value": "string" }
          ]
        }
      ]
    }
  ]
}
`;

  const prompt = `Context: ${userContext}. Create a comprehensive survey for this supplier. Return ONLY the JSON.`;

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'gemini', // Using gemini as per user instruction to replace gemini implementation
        messages: [
          { role: 'system', content: systemInstruction },
          { role: 'user', content: prompt }
        ],
        stream: false
      }),
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`API call failed: ${response.status} ${errorText}`);
    }

    const data = await response.json();
    
    // The worker returns the OpenAI-compatible response format or the direct result depending on implementation.
    // Based on multi-model-worker.js:
    // return new Response(JSON.stringify(response), ...) where response is the result from callModelAPI
    // callModelAPI returns `data` from the upstream API.
    // Gemini upstream (via openai/chat/completions) usually returns { choices: [{ message: { content: ... } }] }
    
    let content = '';
    if (data.choices && data.choices[0] && data.choices[0].message) {
      content = data.choices[0].message.content;
    } else if (data.candidates && data.candidates[0] && data.candidates[0].content && data.candidates[0].content.parts) {
       // Fallback if it returns raw Gemini format (unlikely given the URL path in worker)
       content = data.candidates[0].content.parts[0].text;
    } else {
       // Fallback: maybe the worker returns just the content or some other structure?
       // Let's assume standard OpenAI format as the worker calls .../openai/chat/completions
       console.log('Unknown response format:', data);
       throw new Error('Unknown response format from API');
    }

    // Clean up markdown code blocks if present
    const jsonString = content.replace(/^```json\s*/, '').replace(/^```\s*/, '').replace(/\s*```$/, '');
    
    return JSON.parse(jsonString) as SurveySchema;

  } catch (error) {
    console.error('AI Service Error:', error);
    throw error;
  }
}
