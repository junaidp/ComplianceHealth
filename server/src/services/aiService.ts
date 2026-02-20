import OpenAI from 'openai';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

const SYSTEM_PROMPT = `You are an expert PDPL (Saudi Personal Data Protection Law) compliance advisor specializing in the KSA healthcare sector. You provide specific, actionable, and legally precise remediation guidance.

Legal reference hierarchy (in order of authority):
1. PDPL Implementing Regulation (SDAIA) — primary operative text
2. Regulation on Personal Data Transfer outside the Kingdom (SDAIA)
3. MoH Data Governance Policy
4. NCA Essential Cybersecurity Controls (ECC)
5. The PDPL itself

Always cite the EXACT Regulation article (e.g., 'Reg. Art. 25(1)(b)').

Key rules always apply:
- DPO mandatory for ALL healthcare orgs (Reg. Art. 32(1)(c))
- DPIA has 7 triggers under Reg. Art. 25(1) — all must be checked
- SCCs must use SDAIA standard model (Transfer Reg. Art. 5(1)(b))
- DSR response: 30 days, extendable by 30 with advance notice (max 60 total)
- Explicit consent required for: sensitive data, credit data, automated decisions
- ROPA retained during processing + 5 years after completion (Reg. Art. 33(1))
- Breach notification to data subjects requires recommendations/advice (Reg. Art. 24(5)(d))
- Health data processors must implement task segregation (Reg. Art. 26(3))
- Stage-by-stage health data documentation required (Reg. Art. 26(4))

Format every response:
(1) What the Regulation requires — cite the article
(2) Why it matters for this specific health organization
(3) Step-by-step implementation actions
(4) Evidence to collect
(5) Recommended template or tool
(6) Suggested deadline

End every response: 'AI-Suggested — Review by DPO Required. This is not legal advice.'`;

interface RemediationInput {
  orgType: string;
  size?: number;
  processesMinors: boolean;
  usesAi: boolean;
  continuousMonitoring: boolean;
  crossBorderTransfers: boolean;
  applicableRegulatoryBodies: string[];
  controlId: string;
  controlObjective: string;
  riskLevel: string;
  regArticles?: string;
  transferRegArticles?: string;
  ncaRef?: string;
  mohPolicyRef?: string;
  evidenceGuidance?: string;
  mohImplGuidance?: string;
  gapType: string;
  notes?: string;
}

export async function generateRemediationGuidance(input: RemediationInput): Promise<string> {
  const userPrompt = `Organization Type: ${input.orgType} | Size: ${input.size || 'N/A'}
Processes minors: ${input.processesMinors} | Uses AI/Automated Decisions: ${input.usesAi}
Continuous monitoring: ${input.continuousMonitoring} | Cross-border transfers: ${input.crossBorderTransfers}
Applicable regulatory bodies: ${input.applicableRegulatoryBodies.join(', ')}

Failed Control: ${input.controlId} — ${input.controlObjective}
Risk Level: ${input.riskLevel}
Legal Basis: ${input.regArticles || 'N/A'} / ${input.transferRegArticles || 'N/A'} / ${input.ncaRef || 'N/A'} / ${input.mohPolicyRef || 'N/A'}
Evidence Guidance: ${input.evidenceGuidance || 'N/A'}
MoH Implementation Guidance: ${input.mohImplGuidance || 'N/A'}
Gap Type: ${input.gapType} (GAP = not implemented, PARTIAL = in progress)
User Notes: ${input.notes || 'None provided'}

Provide specific remediation guidance for this organization to resolve this compliance gap.`;

  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        { role: 'user', content: userPrompt },
      ],
      max_tokens: 1500,
      temperature: 0.3,
    });

    return response.choices[0]?.message?.content || 'Unable to generate guidance. Please consult your DPO.';
  } catch (error: any) {
    console.error('OpenAI API error:', error.message);
    return 'AI guidance temporarily unavailable. Please refer to the evidence guidance for this control.';
  }
}

export async function analyzeDocument(documentText: string, controlObjective: string): Promise<{ analysis: string; confidence: number }> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Analyze this document against the following control requirement:

Control Objective: ${controlObjective}

Document Content:
<document>${documentText.substring(0, 5000)}</document>

Assess:
1. Does this document satisfy the control requirement? (confidence score 0-100)
2. What gaps remain?
3. What additional evidence is needed?

Respond in JSON format: { "satisfies": boolean, "confidence": number, "analysis": string, "gaps": string[], "additionalEvidence": string[] }`,
        },
      ],
      max_tokens: 800,
      temperature: 0.2,
    });

    const content = response.choices[0]?.message?.content || '';
    try {
      const parsed = JSON.parse(content.replace(/```json\n?|\n?```/g, ''));
      return { analysis: content, confidence: parsed.confidence || 0 };
    } catch {
      return { analysis: content, confidence: 0 };
    }
  } catch (error: any) {
    console.error('OpenAI API error:', error.message);
    return { analysis: 'Document analysis temporarily unavailable.', confidence: 0 };
  }
}

export async function generateGapNarrative(gaps: Array<{ controlId: string; riskLevel: string; objective: string }>): Promise<string> {
  try {
    const gapList = gaps.map(g => `- ${g.controlId} (${g.riskLevel}): ${g.objective}`).join('\n');
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate an executive-readable narrative summarizing the following compliance risk exposure for a healthcare organization:\n\n${gapList}\n\nProvide a concise, board-level summary of the key risks and recommended priority actions.`,
        },
      ],
      max_tokens: 1000,
      temperature: 0.3,
    });
    return response.choices[0]?.message?.content || '';
  } catch (error: any) {
    console.error('OpenAI API error:', error.message);
    return 'Gap narrative generation temporarily unavailable.';
  }
}

export async function trainingChatbot(question: string, moduleContext: string): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT + '\n\nYou are now acting as a training assistant. Answer questions about PDPL compliance in the healthcare context. Keep responses concise and educational.' },
        {
          role: 'user',
          content: `Module Context: ${moduleContext}\n\nQuestion: ${question}`,
        },
      ],
      max_tokens: 500,
      temperature: 0.3,
    });
    return response.choices[0]?.message?.content || 'Unable to answer. Please try again.';
  } catch (error: any) {
    console.error('OpenAI API error:', error.message);
    return 'Training chatbot temporarily unavailable.';
  }
}

export async function generatePolicyTemplate(controlId: string, controlRequirements: string, orgType: string, profileFlags: Record<string, any>): Promise<string> {
  try {
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        { role: 'system', content: SYSTEM_PROMPT },
        {
          role: 'user',
          content: `Generate a draft policy/procedure template for:

Control: ${controlId}
Requirements: ${controlRequirements}
Organization Type: ${orgType}
Profile Flags: ${JSON.stringify(profileFlags)}

Create a comprehensive, healthcare-specific policy template that satisfies this control requirement. Include all necessary sections, responsible parties, and procedures.`,
        },
      ],
      max_tokens: 2000,
      temperature: 0.3,
    });
    return response.choices[0]?.message?.content || '';
  } catch (error: any) {
    console.error('OpenAI API error:', error.message);
    return 'Policy template generation temporarily unavailable.';
  }
}
