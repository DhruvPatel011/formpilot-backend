const logger = require('../utils/logger');

const GEMINI_BASE_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

class GeminiService {
  constructor() {
    this.apiKey = process.env.GEMINI_API_KEY;
    if (!this.apiKey) {
      logger.warn('GEMINI_API_KEY not set — AI features disabled');
    }
  }

  async generate(prompt, systemInstruction = null, options = {}) {
    if (!this.apiKey) {
      throw new Error('AI service not configured. Please add GEMINI_API_KEY.');
    }

    const body = {
      contents: [{ role: 'user', parts: [{ text: prompt }] }],
      generationConfig: {
        temperature: options.temperature ?? 0.3,
        maxOutputTokens: options.maxTokens ?? 2048,
        topP: 0.95,
      },
      safetySettings: [
        { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_NONE' },
        { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
        { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_NONE' },
      ],
    };

    if (systemInstruction) {
      body.systemInstruction = { parts: [{ text: systemInstruction }] };
    }

    const url = `${GEMINI_BASE_URL}?key=${this.apiKey}`;
    const res = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      logger.error('Gemini API error:', err);
      throw new Error(`Gemini API error: ${res.status} ${err.error?.message || res.statusText}`);
    }

    const data = await res.json();
    const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
    if (!text) throw new Error('Empty response from Gemini');
    return text;
  }

  /**
   * Parse JSON from Gemini response safely
   */
  async generateJSON(prompt, systemInstruction = null, options = {}) {
    const text = await this.generate(prompt, systemInstruction, options);
    try {
      // Strip markdown code fences if present
      const cleaned = text.replace(/```json\n?/g, '').replace(/```\n?/g, '').trim();
      return JSON.parse(cleaned);
    } catch {
      logger.warn('Gemini returned non-JSON, attempting extraction:', text.slice(0, 200));
      const jsonMatch = text.match(/\{[\s\S]*\}|\[[\s\S]*\]/);
      if (jsonMatch) return JSON.parse(jsonMatch[0]);
      throw new Error('Could not parse JSON from AI response');
    }
  }

  /**
   * Generate answers for form fields using profile data
   */
  async generateFormAnswers(fields, profileData, formContext = '') {
    const system = `You are FormPilot AI — an expert at filling online forms accurately.
You receive form field labels/questions and user profile data.
Return ONLY a valid JSON object mapping each field index to the best answer.
Be concise, accurate, and context-aware. If unsure, use the most appropriate value from the profile.
Format dates as requested by the field. For selections, pick the most relevant option.`;

    const prompt = `Profile Data:
${JSON.stringify(profileData, null, 2)}

Form Context: ${formContext || 'General form'}

Form Fields:
${fields.map((f, i) => `[${i}] Label: "${f.label}" | Type: ${f.type}${f.options ? ` | Options: ${f.options.join(', ')}` : ''}${f.placeholder ? ` | Placeholder: ${f.placeholder}` : ''}`).join('\n')}

Return JSON: { "0": "answer", "1": "answer", ... }
Only include fields you can answer. Skip file upload fields.`;

    return this.generateJSON(prompt, system, { temperature: 0.2 });
  }

  /**
   * Parse resume text into structured profile data
   */
  async parseResume(resumeText) {
    const system = `You are an expert resume parser. Extract structured information from resume text.
Return ONLY valid JSON matching the exact schema provided. Never add fields not in the schema.`;

    const prompt = `Extract information from this resume:

${resumeText.slice(0, 8000)}

Return this JSON schema (fill what's available, use null for missing):
{
  "fullName": "",
  "email": "",
  "phone": "",
  "city": "",
  "state": "",
  "country": "",
  "linkedin": "",
  "github": "",
  "portfolio": "",
  "currentRole": "",
  "currentCompany": "",
  "totalExperience": "",
  "skills": [],
  "languages": [],
  "education": [{"institution":"","degree":"","branch":"","startYear":null,"endYear":null,"grade":""}],
  "experience": [{"company":"","role":"","startDate":"","endDate":"","isCurrently":false,"description":""}],
  "certifications": [],
  "achievements": []
}`;

    return this.generateJSON(prompt, system, { temperature: 0.1 });
  }

  /**
   * Smart field mapping — map profile fields to form fields
   */
  async mapFieldsToProfile(fields, profileData) {
    const system = `You are an expert at matching form field labels to user profile data.
Given form fields and profile data, return confidence-scored mappings.
Return ONLY valid JSON.`;

    const prompt = `Profile fields available: ${Object.keys(profileData).join(', ')}

Form fields to map:
${fields.map((f, i) => `[${i}] "${f.label}" (type: ${f.type})`).join('\n')}

Return JSON array: [{"fieldIndex": 0, "profileKey": "fullName", "confidence": 0.98}]
Only include fields with confidence > 0.5. Use null profileKey if no match.`;

    return this.generateJSON(prompt, system, { temperature: 0.1 });
  }

  /**
   * Internship/Job application assistant
   */
  async generateJobApplicationAnswers(fields, profileData, jobDescription = '') {
    const system = `You are an expert career coach and job application assistant.
Generate professional, compelling answers for job application form fields.
Use the user's profile data as the basis but craft answers that are professional and tailored.`;

    const prompt = `Job/Internship Description: ${jobDescription || 'Software Engineering role'}

Applicant Profile:
${JSON.stringify(profileData, null, 2)}

Form Fields:
${fields.map((f, i) => `[${i}] "${f.label}" (${f.type})`).join('\n')}

Generate professional answers. Return JSON: { "0": "answer", ... }`;

    return this.generateJSON(prompt, system, { temperature: 0.5 });
  }

  /**
   * Scholarship form assistant
   */
  async generateScholarshipAnswers(fields, profileData, scholarshipInfo = '') {
    const system = `You are a scholarship application expert.
Generate compelling, honest answers for scholarship form fields based on the applicant's profile.
Highlight achievements, goals, and merit naturally.`;

    const prompt = `Scholarship: ${scholarshipInfo || 'Merit-based scholarship'}

Applicant Profile:
${JSON.stringify(profileData, null, 2)}

Form Fields:
${fields.map((f, i) => `[${i}] "${f.label}" (${f.type})`).join('\n')}

Return professional scholarship answers as JSON: { "0": "answer", ... }`;

    return this.generateJSON(prompt, system, { temperature: 0.6 });
  }
}

module.exports = new GeminiService();
