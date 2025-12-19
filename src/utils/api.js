/**
 * Integration with Gemini API for environmental analysis
 */

const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent';

/**
 * Optimized prompt for environmental product analysis
 */
const ENVIRONMENTAL_ANALYSIS_PROMPT = `You are an environmental analysis AI inside a browser extension. 
Given only lightweight scraped text (materials, description, ingredients, packaging, certifications):

1. Classify the product as:
   - Eco-Friendly
   - Moderate
   - Not Eco-Friendly

2. Return JSON:
{
 "label": "",
 "confidence": 0-100,
 "summary": "",
 "explanation": {
   "carbon_footprint": "",
   "recyclability": "",
   "toxicity": "",
   "durability": "",
   "certifications_found": [],
   "greenwashing_risk": ""
 }
}

Use fast, resource-friendly heuristics based on:
- Materials
- Packaging
- Certifications
- Durability
- Manufacturing claims
- Risk of greenwashing

IMPORTANT: Return ONLY valid JSON, no markdown, no code blocks, just the JSON object.`;

/**
 * Analyzes a product using Gemini API
 * @param {string} productText - Clean product text
 * @param {string} apiKey - Gemini API key
 * @returns {Promise<Object>} Analysis result
 */
export async function analyzeProduct(productText, apiKey) {
  if (!productText || productText.trim().length === 0) {
    throw new Error('No product text provided for analysis');
  }
  
  if (!apiKey) {
    throw new Error('Gemini API key not provided');
  }
  
  const fullPrompt = `${ENVIRONMENTAL_ANALYSIS_PROMPT}\n\nProduct information:\n${productText}`;
  
  try {
    const response = await fetch(`${GEMINI_API_URL}?key=${apiKey}`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        contents: [{
          parts: [{
            text: fullPrompt
          }]
        }],
        generationConfig: {
          temperature: 0.3,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 1024,
        }
      })
    });
    
    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      throw new Error(
        errorData.error?.message || 
        `API Error: ${response.status} ${response.statusText}`
      );
    }
    
    const data = await response.json();
    
    // Extract text from response
    const responseText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
    
    if (!responseText) {
      throw new Error('API did not return content');
    }
    
    // Parse JSON from response
    const analysis = parseGeminiResponse(responseText);
    
    return analysis;
  } catch (error) {
    console.error('Error calling Gemini API:', error);
    throw error;
  }
}

/**
 * Parses Gemini response and extracts JSON
 * @param {string} responseText - Gemini response text
 * @returns {Object} Parsed analysis
 */
function parseGeminiResponse(responseText) {
  try {
    // Try to extract JSON from text (may come with markdown or additional text)
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if they exist
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    
    // Find JSON object (may be between braces)
    const jsonMatch = jsonText.match(/\{[\s\S]*\}/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
    
    const parsed = JSON.parse(jsonText);
    
    // Validate structure
    if (!parsed.label || !parsed.explanation) {
      throw new Error('API response has invalid structure');
    }
    
    // Ensure required fields exist
    return {
      label: parsed.label || 'Moderate',
      confidence: parsed.confidence || 50,
      summary: parsed.summary || '',
      explanation: {
        carbon_footprint: parsed.explanation?.carbon_footprint || 'Not available',
        recyclability: parsed.explanation?.recyclability || 'Not available',
        toxicity: parsed.explanation?.toxicity || 'Not available',
        durability: parsed.explanation?.durability || 'Not available',
        certifications_found: Array.isArray(parsed.explanation?.certifications_found) 
          ? parsed.explanation.certifications_found 
          : [],
        greenwashing_risk: parsed.explanation?.greenwashing_risk || 'Not available'
      }
    };
  } catch (error) {
    console.error('Error parsing Gemini response:', error);
    // Return default response in case of error
    return {
      label: 'Moderate',
      confidence: 0,
      summary: 'Error analyzing product',
      explanation: {
        carbon_footprint: 'Analysis error',
        recyclability: 'Analysis error',
        toxicity: 'Analysis error',
        durability: 'Analysis error',
        certifications_found: [],
        greenwashing_risk: 'Analysis error'
      }
    };
  }
}

