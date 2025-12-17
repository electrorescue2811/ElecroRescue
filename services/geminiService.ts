
import { GoogleGenAI, Type, Schema } from "@google/genai";
import { AnalysisResult, ProjectIdea } from "../types";

// Schema definition for the JSON output
const analysisSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    summary: {
      type: Type.ARRAY,
      items: { type: Type.STRING },
      description: "A quantified list of SPECIFIC component types. Do not group them generically. Example: '12x MLCC Capacitors', '3x Electrolytic Capacitors', '5x 0603 Resistors'."
    },
    components: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          name: { type: Type.STRING, description: "Name or marking (e.g., 'C12', 'R5', 'U1')" },
          type: { type: Type.STRING, description: "Specific type (e.g., 'Electrolytic Capacitor', 'Ceramic Capacitor')" },
          function: { type: Type.STRING, description: "Brief note on purpose" },
          isCritical: { type: Type.BOOLEAN, description: "Is this a critical IC?" }
        },
        required: ["name", "type", "function", "isCritical"]
      },
      description: "Detailed list of components found."
    },
    pcbCategory: { type: Type.STRING, description: "Likely application or category." },
    damageAssessment: {
      type: Type.OBJECT,
      properties: {
        detected: { type: Type.BOOLEAN },
        visibleFaults: { type: Type.ARRAY, items: { type: Type.STRING } },
        conditionGrade: { 
          type: Type.STRING, 
          enum: ["A", "B", "C", "D"],
          description: "A: Excellent/Clean. B: Good/Minor Dust. C: Fair/Damage/Grime. D: Poor/Severe."
        },
        conditionDescription: { type: Type.STRING, description: "Detailed description of condition and cleanliness." }
      },
      required: ["detected", "visibleFaults", "conditionGrade", "conditionDescription"]
    },
    costAnalysis: {
      type: Type.OBJECT,
      properties: {
        componentValueRange: { type: Type.STRING, description: "Value range in INR." },
        manufacturingComplexity: { type: Type.STRING },
        conditionDepreciation: { type: Type.STRING }
      },
      required: ["componentValueRange", "manufacturingComplexity", "conditionDepreciation"]
    },
    finalValuation: {
      type: Type.OBJECT,
      properties: {
        asIsValue: { type: Type.STRING, description: "Raw Component Value in INR." }
      },
      required: ["asIsValue"]
    },
    technicalInsights: { type: Type.STRING },
    suggestions: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["summary", "components", "pcbCategory", "damageAssessment", "costAnalysis", "finalValuation", "technicalInsights", "suggestions"]
};

const projectIdeasSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    projects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          difficulty: { type: Type.STRING, enum: ["Beginner", "Intermediate", "Advanced"] },
          missingComponents: { 
            type: Type.ARRAY, 
            items: { type: Type.STRING },
            description: "List of essential components the user did NOT list but needs to complete this project."
          },
          steps: {
            type: Type.ARRAY,
            items: { type: Type.STRING },
            description: "Step-by-step instructions."
          }
        },
        required: ["title", "description", "difficulty", "missingComponents", "steps"]
      }
    }
  },
  required: ["projects"]
};

const SYSTEM_INSTRUCTION = `
You are "ElectroRescue.AI", a specialized Electronics Vision Analysis Agent.
Analyze the PCB image provided. Be concise and technically precise.

# OBJECTIVE
1. **COMPONENT COUNTING (CRITICAL)**: In the 'summary' output, you MUST separate components by subtype.
   - ❌ WRONG: "15x Capacitors"
   - ✅ CORRECT: "12x Ceramic Capacitors", "3x Electrolytic Capacitors", "1x Tantalum Capacitor".
   - ❌ WRONG: "Resistors"
   - ✅ CORRECT: "10x SMD Resistors", "2x Power Resistors".
   - ❌ WRONG: "Connectors"
   - ✅ CORRECT: "1x USB-C Port", "1x JST Connector".
2. **QUALITY & CLEANLINESS**: Detect environmental conditions.
   - Look for: Dust accumulation, Flux residue, Grime, Oxidation, Debris.
   - Add these to 'visibleFaults' if present (e.g., "Heavy Dust Accumulation", "Flux Residue").
3. **DAMAGE ANALYSIS**:
   - Check for burns, cracks, corrosion, bent pins, broken traces.
   - Grade A: Like new, very clean.
   - Grade B: Good, minor dust or signs of use.
   - Grade C: Visible dirt, grime, or component damage.
   - Grade D: Severe damage, heavy corrosion, burns.
4. **VALUATION (STRICT PRICING RULES IN INR)**: 
   - You are estimating the **salvage value** of visible components ONLY.
   - **General Rule**: The total 'asIsValue' must generally be **BELOW ₹200 INR**.
   - **Condition Rule**: If the Condition Grade is **B, C, or D**, the value MUST be **BELOW ₹150 INR**.
   - **High Density Exception**: ONLY if the visual component count is clearly **> 65 components**, you may estimate between **₹100 - ₹250 INR**.
   - Do NOT provide a resale value for the whole board. Only the scrap/component value.
`;

export const analyzePCBImage = async (base64Image: string, mimeType: string): Promise<AnalysisResult> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key is missing. Please ensure process.env.API_KEY is set.");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: {
        parts: [
          {
            inlineData: {
              mimeType: mimeType,
              data: base64Image
            }
          },
          {
            text: "Analyze this PCB. Count specific component types. Check for DAMAGE. Provide conservative salvage valuation in INR < 200."
          }
        ]
      },
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
        responseMimeType: "application/json",
        responseSchema: analysisSchema,
        temperature: 0.1, // Lower temperature for faster, more deterministic results
      }
    });

    const text = response.text;
    if (!text) {
      throw new Error("No response text received from Gemini.");
    }

    return JSON.parse(text) as AnalysisResult;

  } catch (error) {
    console.error("Analysis failed:", error);
    throw error;
  }
};

export const sendChatMessage = async (history: { role: string, parts: { text: string }[] }[], message: string, userRole: string = 'Hobbyist'): Promise<string> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) {
      throw new Error("API Key is missing.");
    }

    const ai = new GoogleGenAI({ apiKey });
    
    const systemInstruction = `You are "ResQ". Helpful electronics assistant. User role: ${userRole}. Keep answers concise, helpful and friendly.`;

    const chat = ai.chats.create({
      model: "gemini-2.5-flash", // Using Flash for speed and stability
      config: {
        systemInstruction: systemInstruction,
      },
      history: history
    });

    const result = await chat.sendMessage({ message });
    return result.text || "I'm sorry, I couldn't generate a response at this time.";
  } catch (error) {
    console.error("Chat error:", error);
    throw error;
  }
};

// --- PROJECT GENERATOR FUNCTIONS ---

export const generateProjectIdeas = async (componentList: string): Promise<ProjectIdea[]> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing.");

    const ai = new GoogleGenAI({ apiKey });
    
    // Strict prompt for 3 Easy, 1 Medium, 1 Hard
    const prompt = `Based on these components: "${componentList}", suggest exactly 5 DIY projects.
    DISTRIBUTION RULES:
    1. 3 Projects must be 'Beginner' level (Simple circuits).
    2. 1 Project must be 'Intermediate' level.
    3. 1 Project must be 'Advanced' level.
    
    For each project, provide a title, description, and list missing components. 
    Include step-by-step instructions.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
      config: {
        systemInstruction: "You are a DIY electronics expert. Output JSON only.",
        responseMimeType: "application/json",
        responseSchema: projectIdeasSchema,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response from Gemini");

    const parsed = JSON.parse(text);
    return parsed.projects || [];
  } catch (error) {
    console.error("Project generation failed:", error);
    throw error;
  }
};

// Schema for Recommended projects (No steps initially to save tokens)
const recommendedSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    projects: {
      type: Type.ARRAY,
      items: {
        type: Type.OBJECT,
        properties: {
          title: { type: Type.STRING },
          description: { type: Type.STRING },
          difficulty: { type: Type.STRING, enum: ["Beginner", "Intermediate", "Advanced"] },
          missingComponents: { 
             type: Type.ARRAY, 
             items: { type: Type.STRING }, 
             description: "Full list of components needed."
          }
        },
        required: ["title", "description", "difficulty", "missingComponents"]
      }
    }
  },
  required: ["projects"]
};

export const getRecommendedProjects = async (excludeTitles: string[] = []): Promise<ProjectIdea[]> => {
  try {
    const apiKey = process.env.API_KEY;
    if (!apiKey) throw new Error("API Key is missing.");

    const ai = new GoogleGenAI({ apiKey });
    
    let exclusionText = "";
    if (excludeTitles.length > 0) {
        exclusionText = `\nCRITICAL: You MUST NOT suggest these projects: ${excludeTitles.slice(-20).join(', ')}. Generate COMPLETELY NEW ideas.`;
    }

    const prompt = `Suggest exactly 10 Recommended Electronics Projects.${exclusionText}
    DISTRIBUTION RULES:
    1. 5 Projects: 'Beginner' (Easy, basic components).
    2. 3 Projects: 'Intermediate' (Useful gadgets).
    3. 2 Projects: 'Advanced' (Must involve Microprocessors/Microcontrollers like Arduino/ESP32).
    
    Do NOT include steps yet. Provide Title, Description, Difficulty, and Required Components.`;

    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: recommendedSchema,
      }
    });

    const text = response.text;
    if (!text) throw new Error("No response");

    const parsed = JSON.parse(text);
    return parsed.projects || [];
  } catch (error) {
    console.error("Recommended fetch failed:", error);
    return [];
  }
};

// Schema for Steps Only
const guideSchema: Schema = {
  type: Type.OBJECT,
  properties: {
    steps: { type: Type.ARRAY, items: { type: Type.STRING } }
  },
  required: ["steps"]
};

export const getProjectGuide = async (title: string, components: string[]): Promise<string[]> => {
  try {
     const apiKey = process.env.API_KEY;
     if (!apiKey) throw new Error("API Key is missing.");

     const ai = new GoogleGenAI({ apiKey });
     const prompt = `Provide detailed step-by-step build instructions for the electronics project: "${title}".
     Components used: ${components.join(', ')}.`;

     const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: { parts: [{ text: prompt }] },
      config: {
        responseMimeType: "application/json",
        responseSchema: guideSchema,
      }
    });

    const text = response.text;
    if(!text) return ["Failed to generate steps."];
    return JSON.parse(text).steps || [];

  } catch (error) {
    console.error("Guide generation failed:", error);
    return ["Error generating guide. Please try again."];
  }
}
