// We will use fetch directly to call OpenAI's Chat Completion API
// The API key must be set in the environment as OPENAI_API_KEY

/**
 * Generates a tailored closing script and rebuttals using GPT-4.
 * @param {Object} input - Client profile and selected plan information.
 * @returns {Promise<Object>} An object with pitch and rebuttals array.
 */
export async function generateClosingScript({ planId, zip, dob, medicaid, lis, dsnp, chronicConditions, desiredBenefits }) {
  // Build the prompt for the AI model
  const prompt = `
You are an expert Medicare Advantage sales agent. Craft a persuasive yet compliant closing script for a client:
- ZIP code: ${zip}
- Date of Birth: ${dob}
- Medicaid: ${medicaid}
- Low-Income Subsidy (LIS): ${lis}
- Dual-eligible SNP (D-SNP): ${dsnp}
- Chronic Conditions: ${chronicConditions?.join(', ') || 'none'}
- Desired Benefits: ${desiredBenefits?.join(', ') || 'none'}
- Selected Plan ID: ${planId}

Provide:
1. A concise pitch (2-3 sentences) highlighting how this plan meets their needs.
2. Three common objections with rebuttals (one sentence each).
Ensure the tone is warm, ethical, and informative.
`;
  // Prepare the request body per OpenAI's Chat Completion API spec
  const body = {
    model: 'gpt-4',
    messages: [
      { role: 'system', content: 'You are a helpful AI assistant.' },
      { role: 'user', content: prompt },
    ],
    max_tokens: 300,
    temperature: 0.7,
  };

  // Send request via fetch to OpenAI API
  const response = await fetch('https://api.openai.com/v1/chat/completions', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${process.env.OPENAI_API_KEY}`,
    },
    body: JSON.stringify(body),
  });
  if (!response.ok) {
    const errText = await response.text();
    throw new Error(`OpenAI API error: ${response.status} ${errText}`);
  }
  const completion = await response.json();
  const answer = completion.choices?.[0]?.message?.content || '';
  // Split the output into lines to separate pitch and rebuttals
  const lines = answer.split(/\n+/).map((l) => l.trim()).filter(Boolean);
  const pitch = lines[0] || '';
  const rebuttals = lines.slice(1).map((line) => line.replace(/^\d+\.\s*/, ''));
  return { pitch, rebuttals };
}