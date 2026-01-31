var __defProp = Object.defineProperty;
var __name = (target, value) => __defProp(target, "name", { value, configurable: true });

// workers/multi-model-worker.js
var API_ENDPOINTS = {
  deepseek: {
    url: "https://api.deepseek.com/v1/chat/completions",
    model: "deepseek-chat",
    keyEnv: "DEEPSEEK_API_KEY",
    maxTokens: 8192
  },
  kimi: {
    url: "https://api.moonshot.cn/v1/chat/completions",
    model: "moonshot-v1-8k",
    keyEnv: "KIMI_API_KEY",
    maxTokens: 4e3
  },
  glm: {
    url: "https://open.bigmodel.cn/api/paas/v4/chat/completions",
    model: "glm-4.5",
    keyEnv: "GLM_API_KEY",
    maxTokens: 8192
  },
  gemini: {
    url: "https://generativelanguage.googleapis.com/v1beta//openai/chat/completions",
    model: "gemini-3-flash-preview",
    keyEnv: "GEMINI_API_KEY",
    maxTokens: 8192
  }
};
var DEFAULT_TIMEOUT = 6e4;
var MAX_TOKENS = 8192;
var TEMPERATURE = 0.7;
var CACHE_TTL = 300;
var requestCache = /* @__PURE__ */ new Map();
function generateCacheKey(model, messages) {
  return `${model}:${JSON.stringify(messages)}`;
}
__name(generateCacheKey, "generateCacheKey");
async function callModelAPI(model, messages, env, stream = false) {
  const startTime = Date.now();
  try {
    const modelConfig = API_ENDPOINTS[model];
    if (!modelConfig) {
      throw new Error(`Unsupported model: ${model}`);
    }
    const apiKey = env[modelConfig.keyEnv];
    if (!apiKey) {
      throw new Error(`${model.toUpperCase()} API key is not configured`);
    }
    const cacheKey = stream ? null : generateCacheKey(model, messages);
    if (cacheKey && requestCache.has(cacheKey)) {
      const cached = requestCache.get(cacheKey);
      if (Date.now() - cached.timestamp < CACHE_TTL * 1e3) {
        console.log(`Cache hit for ${model} request`);
        return cached.data;
      }
    }
    const requestBody = {
      model: modelConfig.model,
      messages,
      temperature: TEMPERATURE,
      max_tokens: modelConfig.maxTokens || MAX_TOKENS,
      max_completion_tokens: modelConfig.maxTokens || MAX_TOKENS // Add this line for better compatibility
    };
    if (stream) {
      requestBody.stream = true;
    }
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), DEFAULT_TIMEOUT);
    try {
      const response = await fetch(modelConfig.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "Authorization": `Bearer ${apiKey}`,
          "User-Agent": "Multi-Model-Worker/1.0",
          "Accept": stream ? "text/event-stream" : "application/json"
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        // Cloudflare specific optimizations
        cf: {
          cacheEverything: false,
          cacheTtl: 0,
          connectTimeout: 5e3,
          readTimeout: 25e3
        }
      });
      clearTimeout(timeoutId);
      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error?.message || errorData.message || `HTTP error! Status: ${response.status}`);
      }
      if (stream) {
        console.log(`${model} streaming request completed in ${Date.now() - startTime}ms`);
        console.log(`Streaming response content-type: ${response.headers.get("content-type")}`);
        console.log(`Streaming response status: ${response.status}`);
        return response;
      } else {
        const result = await response.json();
        if (cacheKey) {
          requestCache.set(cacheKey, {
            data: result,
            timestamp: Date.now()
          });
        }
        console.log(`${model} request completed in ${Date.now() - startTime}ms`);
        return result;
      }
    } catch (fetchError) {
      clearTimeout(timeoutId);
      if (fetchError.name === "AbortError") {
        throw new Error("Request timeout");
      }
      throw fetchError;
    }
  } catch (error) {
    console.error(`${model} API call error:`, error);
    throw error;
  }
}
__name(callModelAPI, "callModelAPI");
async function handleStreamingResponse(response, model) {
  console.log(`handleStreamingResponse called for ${model}`);
  console.log(`Response status: ${response.status}`);
  console.log(`Response content-type: ${response.headers.get("content-type")}`);
  if (!response.body) {
    console.error(`No response body available for ${model}`);
    return new ReadableStream({
      start(controller) {
        controller.error(new Error("No response body available"));
      }
    });
  }
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8", { stream: true });
  let buffer = "";
  let lineCount = 0;
  let hasData = false;
  let hasSentData = false;
  console.log(`Starting to handle streaming response for ${model}`);
  return new ReadableStream({
    async start(controller) {
      try {
        while (true) {
          console.log(`Reading from stream for ${model}...`);
          const { done, value } = await reader.read();
          if (done) {
            console.log(`Stream ended for ${model}, hasData: ${hasData}, hasSentData: ${hasSentData}`);
            break;
          }
          const chunk = decoder.decode(value, { stream: true });
          console.log(`Received chunk for ${model} (${value.length} bytes):`, chunk);
          hasData = true;
          buffer += chunk;
          const lines = buffer.split("\n");
          buffer = lines.pop();
          console.log(`Processing ${lines.length} lines for ${model}`);
          for (const line of lines) {
            if (line.trim() === "") continue;
            console.log(`Processing line for ${model}:`, line);
            if (line.startsWith("data: ")) {
              const data = line.slice(6);
              console.log(`SSE data for ${model}:`, data);
              if (data === "[DONE]") {
                console.log(`Received [DONE] signal for ${model}`);
                controller.close();
                return;
              }
              try {
                const parsed = JSON.parse(data);
                console.log(`Parsed SSE data for ${model}:`, parsed);
                const content = parsed.choices?.[0]?.delta?.content || "";
                if (content) {
                  lineCount++;
                  hasSentData = true;
                  console.log(`Sending content for ${model} (line ${lineCount}):`, content);
                  const responseLine = JSON.stringify({
                    model,
                    line: lineCount,
                    content,
                    done: false,
                    timestamp: Date.now()
                  }) + "\n";
                  console.log(`Enqueuing response for ${model}:`, responseLine);
                  controller.enqueue(responseLine);
                }
              } catch (e) {
                console.error("Error parsing SSE data:", e, "Data:", data);
              }
            } else {
              try {
                const parsed = JSON.parse(line);
                console.log(`Parsed raw JSON for ${model}:`, parsed);
                const content = parsed.choices?.[0]?.delta?.content || parsed.choices?.[0]?.text || "";
                if (content) {
                  lineCount++;
                  hasSentData = true;
                  console.log(`Sending raw JSON content for ${model} (line ${lineCount}):`, content);
                  const responseLine = JSON.stringify({
                    model,
                    line: lineCount,
                    content,
                    done: false,
                    timestamp: Date.now()
                  }) + "\n";
                  console.log(`Enqueuing response for ${model}:`, responseLine);
                  controller.enqueue(responseLine);
                }
              } catch (e) {
                console.error("Error parsing raw JSON data:", e, "Line:", line);
              }
            }
          }
        }
        console.log(`Sending completion signal for ${model}, total lines: ${lineCount}`);
        const completionLine = JSON.stringify({
          model,
          line: lineCount + 1,
          content: "",
          done: true,
          timestamp: Date.now()
        }) + "\n";
        console.log(`Enqueuing completion for ${model}:`, completionLine);
        controller.enqueue(completionLine);
        controller.close();
      } catch (error) {
        console.error("Streaming error:", error);
        controller.error(error);
      }
    }
  });
}
__name(handleStreamingResponse, "handleStreamingResponse");
var multi_model_worker_default = {
  async fetch(request, env, ctx) {
    const url = new URL(request.url);
    const path = url.pathname;
    const corsHeaders = {
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
      "Access-Control-Allow-Headers": "Content-Type, Authorization"
    };
    if (request.method === "OPTIONS") {
      return new Response(null, { headers: corsHeaders });
    }
    try {
      if (path === "/health" || path === "/api/health") {
        return new Response(JSON.stringify({
          status: "ok",
          message: "Multi-Model Worker is running",
          timestamp: (/* @__PURE__ */ new Date()).toISOString(),
          models_configured: {
            deepseek: !!env.DEEPSEEK_API_KEY,
            kimi: !!env.KIMI_API_KEY,
            glm: !!env.GLM_API_KEY,
            gemini: !!env.GEMINI_API_KEY
          }
        }), {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      if (path === "/models" || path === "/api/models") {
        return new Response(JSON.stringify({
          models: Object.keys(API_ENDPOINTS),
          details: API_ENDPOINTS
        }), {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      if (path === "/chat" || path === "/api/chat" || path === "/" || path === "/api/multi-model") {
        if (request.method !== "POST") {
          return new Response(JSON.stringify({
            error: "Method not allowed",
            message: "Only POST requests are supported"
          }), {
            status: 405,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }
        try {
          let body;
          try {
            body = await request.json();
          } catch (e) {
            return new Response(JSON.stringify({
              error: "Invalid JSON",
              message: "Request body must be valid JSON"
            }), {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            });
          }
          let model = body.model || "deepseek";
          if (!API_ENDPOINTS[model]) {
            return new Response(JSON.stringify({
              error: "Invalid model",
              message: `Model '${model}' is not supported. Available models: ${Object.keys(API_ENDPOINTS).join(", ")}`
            }), {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            });
          }
          let messages;
          if (body.prompt) {
            messages = [{
              role: "user",
              content: body.prompt.trim()
            }];
          } else if (body.messages && Array.isArray(body.messages)) {
            messages = body.messages;
          } else {
            return new Response(JSON.stringify({
              error: "Invalid request format",
              message: 'Request must contain either "prompt" or "messages" field'
            }), {
              status: 400,
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            });
          }
          const streamMode = body.stream === true || body.stream === "true";
          if (streamMode) {
            console.log(`Starting streaming mode for ${model}`);
            console.log(`Request body:`, JSON.stringify(body, null, 2));
            const response = await callModelAPI(model, messages, env, true);
            console.log(`Received response from ${model} API, status: ${response.status}`);
            console.log(`Response headers:`, Object.fromEntries(response.headers.entries()));
            if (!response.body) {
              console.error(`No response body from ${model} API`);
              throw new Error("No response body from model API");
            }
            console.log(`Creating streaming response for ${model}`);
            const stream = await handleStreamingResponse(response, model);
            console.log(`Returning streaming response for ${model}`);
            return new Response(stream, {
              headers: {
                "Content-Type": "text/plain; charset=utf-8",
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "Content-Encoding": "identity",
                // Disable compression for streaming
                "Transfer-Encoding": "chunked",
                ...corsHeaders
              }
            });
          } else {
            const result = await callModelAPI(model, messages, env, false);
            let responseData;
            if (path === "/api/multi-model") {
              const content = result.choices?.[0]?.message?.content || "No response from model";
              responseData = {
                model,
                output: content
              };
            } else {
              responseData = result;
            }
            return new Response(JSON.stringify(responseData), {
              headers: {
                "Content-Type": "application/json",
                ...corsHeaders
              }
            });
          }
        } catch (error) {
          console.error("Error processing model request:", error);
          return new Response(JSON.stringify({
            error: "Model API Error",
            message: error.message
          }), {
            status: 500,
            headers: {
              "Content-Type": "application/json",
              ...corsHeaders
            }
          });
        }
      }
      if (request.method === "GET") {
        return new Response(JSON.stringify({
          message: "Multi-Model Worker API is running",
          endpoints: {
            health: "GET /health - Health check",
            models: "GET /models - Available models",
            chat: "POST /chat - Chat with any supported model"
          },
          example: {
            method: "POST",
            url: "/chat",
            headers: {
              "Content-Type": "application/json"
            },
            body: {
              model: "deepseek",
              messages: [
                { role: "user", content: "Hello, how are you?" }
              ]
            }
          }
        }), {
          headers: {
            "Content-Type": "application/json",
            ...corsHeaders
          }
        });
      }
      return new Response(JSON.stringify({
        error: "Not found",
        message: "Endpoint not found"
      }), {
        status: 404,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    } catch (error) {
      console.error("Worker error:", error);
      return new Response(JSON.stringify({
        error: "Internal server error",
        message: error.message
      }), {
        status: 500,
        headers: {
          "Content-Type": "application/json",
          ...corsHeaders
        }
      });
    }
  }
};
export {
  multi_model_worker_default as default
};
//# sourceMappingURL=multi-model-worker.js.map
