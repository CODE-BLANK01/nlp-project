// // src/routes/ask.js
// import express from "express";
// import OpenAI from "openai";
// import { prisma } from "../prisma.js";
// import { embedText } from "../utils/embeddings.js";

// const router = express.Router();
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// // --------------------
// // Safe JSON Parse (with auto-repair)
// // --------------------
// function safeJSONParse(raw, label = "unknown") {
//   if (!raw) return null;
//   try {
//     return JSON.parse(raw);
//   } catch (err) {
//     console.warn(`[safeJSONParse] Failed initial parse for ${label}:`, err.message);
//     // try to auto-repair common issues
//     try {
//       const fixed = raw
//         .replace(/,\s*]/g, "]")
//         .replace(/,\s*}/g, "}")
//         .replace(/\n/g, " ") // remove stray newlines
//         .trim();
//       return JSON.parse(fixed);
//     } catch (err2) {
//       console.error(`[safeJSONParse] Second attempt failed for ${label}:`, err2.message);
//       return null;
//     }
//   }
// }

// // --------------------
// // Clarification step
// // --------------------
// async function clarifyIfNeeded(question, hits) {
//   const clarifierPrompt = `
// You are a Workday product assistant that decides whether a user question needs clarification.

// Scope:
// - The question is ALWAYS about Workday (any functional area: HCM, Security, Authentication, Time Tracking, Absence, Payroll, etc.).
// - The passages you see come from official Workday documentation.

// The user asked:
// """${question}"""

// We retrieved ${hits.length} passages.

// Your job:
// - Suggest clarifying questions ONLY if the question is ambiguous in a way that would materially change the answer or the steps.
// - Do NOT ask which system or vendor they are using (it's always Workday).
// - Good clarifying dimensions include, for example:
//   - Workday functional area (e.g., Staffing vs Time Tracking vs Security) if it’s unclear.
//   - Worker type (employee vs contingent vs non-worker).
//   - Tenant configuration choices (e.g., enhanced change job vs legacy, security model, or location restrictions) when relevant.
//   - Country/region or legal entity if policies differ by geography.
//   - Whether they want configuration steps vs end-user steps.

// Output:
// Return STRICTLY valid JSON as a single object:

// {
//   "clarifying_questions": ["...", "..."]
// }

// If clarification is NOT needed, return:

// {
//   "clarifying_questions": []
// }
// `;

//   try {
//     const resp = await openai.chat.completions.create({
//       model: "gpt-4o",
//       messages: [{ role: "system", content: clarifierPrompt }],
//       temperature: 0,
//       max_tokens: 200,
//       response_format: { type: "json_object" }, // help enforce JSON
//     });

//     const parsed = safeJSONParse(resp.choices[0].message.content, "clarifier");
//     return parsed?.clarifying_questions || [];
//   } catch (err) {
//     console.error("[Clarifier error]", err);
//     return [];
//   }
// }

// // --------------------
// // Answer step
// // --------------------
// async function answerWithLLM(question, expanded) {
//   const context = expanded
//     .map(
//       (h, i) =>
//         `Source ${i + 1}${h.documentTitle ? ` [${h.documentTitle}]` : ""} (orderIndex=${h.orderIndex ?? "?"}):\n${h.content}`
//     )
//     .join("\n\n");

//   const answerPrompt = `
// You are a senior Workday consultant (all areas: HCM, Security, Authentication, Time Tracking, etc.).
// Your goal is to provide a **complete, practical answer**, not just a minimal one.

// User question:
// """${question}"""

// Context snippets from official Workday documentation:
// ${context}

// Constraints:
// - Treat this as a Workday configuration / business process / security / functional question.
// - Use ONLY what is in the context (or directly implied). If something is not covered, do NOT invent it.
// - If the context is clearly about a specific area (e.g., Staffing / Change Job / Assign Superior), lean into that and give a thorough answer for that area.
// - If the context is incomplete, say so in the summary and keep "steps" focused only on what the docs actually describe.

// Output format:
// Return STRICTLY a single JSON object with this schema:

// {
//   "summary": "2–4 sentence high-level explanation that directly answers the question and sets context (what this is, when it applies, and any key limitations).",
//   "steps": [
//     "Step 1: Detailed, concrete action in Workday, including the task name, where to find it (if known), and why this step matters. 1–3 sentences.",
//     "Step 2: ...",
//     "Step 3: ...",
//     "Include all major prerequisite, configuration, and execution steps mentioned across the sources, not just 2–3 high-level bullets."
//   ],
//   "sources": [
//     "DocumentTitle or sourceUri – brief description of the relevant section you used",
//     "..."
//   ]
// }

// Guidelines for completeness:
// - Err on the side of being **more detailed rather than shorter**, as long as everything is grounded in the context.
// - In "steps", cover:
//   - Any prerequisite setup (e.g., tenant setup, security policy configuration, role assignments).
//   - The main configuration or business process steps (e.g., editing Change Job, adding steps, configuring approvals).
//   - Any important options, defaults, or system behaviors the docs mention (e.g., when a step auto-completes, what triggers a subprocess, or what happens if a setting is not configured).
//   - Any relevant security and access considerations if present in the context.
// - If the context supports it, produce **5–10 well-explained steps**, not just a minimal list.
// - If the context does NOT fully answer the question, say this clearly in "summary" and still provide whatever partial, accurate steps you can from the docs.

// Remember:
// - Return ONLY valid JSON (no markdown, no commentary).
// - Do NOT include fields other than summary, steps, and sources.
// `;

//   try {
//     const resp = await openai.chat.completions.create({
//       model: "gpt-4o",
//       messages: [{ role: "system", content: answerPrompt }],
//       temperature: 0,
//       max_tokens: 1200, // ⬆️ allow bigger, more complete answers
//       response_format: { type: "json_object" },
//     });

//     const raw = resp.choices[0].message.content;
//     const parsed = safeJSONParse(raw, "answer");

//     if (!parsed) {
//       console.warn("[answerWithLLM] Parse failed, returning fallback JSON");
//       return {
//         summary: "I found some relevant info, but formatting failed.",
//         steps: [],
//         sources: [],
//       };
//     }

//     return parsed;
//   } catch (err) {
//     console.error("[Answer error]", err);
//     return {
//       summary: "I found some relevant info, but generation failed.",
//       steps: [],
//       sources: [],
//     };
//   }
// }

// // --------------------
// // Main Ask route
// // --------------------
// router.post("/", async (req, res) => {
//   const start = Date.now();
//   try {
//     const { question } = req.body;
//     if (!question) return res.status(400).json({ ok: false, error: "question_required" });

//     console.log(`🧠 Embedding question: "${question}"`);
//     const qEmbed = await embedText(question);

//     // 1️⃣ Retrieve chunks
//     const hits = await prisma.$queryRaw`
//   SELECT c.id,
//          c.content,
//          c."documentId",
//          d.title        AS "documentTitle",
//          d."sourceUri",
//          c."orderIndex"
//   FROM "Chunk" c
//   JOIN "Document" d ON c."documentId" = d.id
//   ORDER BY c."embeddingVec" <#> ${qEmbed.literal}::vector
//   LIMIT 5;
// `;

//     console.log(`📚 Retrieved ${hits.length}`);

//     // Expand with neighbors
//     const expanded = [];
//     for (const h of hits) {
//       const neighbors = await prisma.chunk.findMany({
//         where: { documentId: h.documentId },
//         orderBy: { orderIndex: "asc" },
//         skip: Math.max(h.orderIndex - 2, 0),
//         take: 5,
//       });
//       expanded.push(...neighbors);
//     }
//     console.log(`📚 Expanded to ${expanded.length}`);

//     // 2️⃣ Clarify if needed
//     const clarifying_questions = await clarifyIfNeeded(question, hits);
//     if (clarifying_questions.length > 0) {
//       console.log("🤔 Clarifying needed:", clarifying_questions);
//     }

//     // 3️⃣ Generate structured answer
//     const answer = await answerWithLLM(question, expanded);

//     const elapsed = Date.now() - start;
//     res.json({
//       ok: true,
//       hits,
//       expanded,
//       summary: answer.summary,
//       steps: answer.steps,
//       sources: answer.sources,
//       clarifying_questions,
//       time: `${elapsed}ms`,
//     });
//   } catch (err) {
//     console.error("[ask error]", err);
//     res.status(500).json({ ok: false, error: "ask_failed", details: err.message });
//   }
// });

// export default router;

// // src/routes/ask.js
// import express from "express";
// import OpenAI from "openai";
// import { prisma } from "../prisma.js";
// import { embedText } from "../utils/embeddings.js";

// const router = express.Router();
// const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

// // --------------------
// // Safe JSON Parse (with auto-repair)
// // --------------------
// function safeJSONParse(raw, label = "unknown") {
//   if (!raw) return null;
//   try {
//     return JSON.parse(raw);
//   } catch (err) {
//     console.warn(`[safeJSONParse] Failed initial parse for ${label}:`, err.message);
//     // try to auto-repair common issues
//     try {
//       const fixed = raw
//         .replace(/,\s*]/g, "]")
//         .replace(/,\s*}/g, "}")
//         .replace(/\n/g, " ") // remove stray newlines
//         .trim();
//       return JSON.parse(fixed);
//     } catch (err2) {
//       console.error(`[safeJSONParse] Second attempt failed for ${label}:`, err2.message);
//       return null;
//     }
//   }
// }

// // --------------------
// // Analyze hits for ambiguity patterns
// // --------------------
// function analyzeHitsForAmbiguity(hits) {
//   const functionalAreas = new Set();
//   const workerTypes = new Set();
//   let hasConfigContent = false;
//   let hasUsageContent = false;

//   hits.forEach((hit) => {
//     const content = hit.content.toLowerCase();

//     // Detect functional areas
//     if (content.includes("staffing") || content.includes("hire") || content.includes("change job")) {
//       functionalAreas.add("Staffing/HCM");
//     }
//     if (content.includes("security") || content.includes("security group") || content.includes("domain")) {
//       functionalAreas.add("Security");
//     }
//     if (content.includes("time tracking") || content.includes("absence") || content.includes("time off")) {
//       functionalAreas.add("Time Tracking/Absence");
//     }
//     if (content.includes("payroll") || content.includes("compensation")) {
//       functionalAreas.add("Payroll/Compensation");
//     }

//     // Detect worker types
//     if (content.includes("employee")) workerTypes.add("employee");
//     if (content.includes("contingent")) workerTypes.add("contingent worker");
//     if (content.includes("manager")) workerTypes.add("manager");

//     // Detect config vs usage
//     if (
//       content.includes("configure") ||
//       content.includes("set up") ||
//       content.includes("business process") ||
//       content.includes("security policy") ||
//       content.includes("tenant setup")
//     ) {
//       hasConfigContent = true;
//     }
//     if (
//       content.includes("access the") ||
//       content.includes("initiate") ||
//       content.includes("submit") ||
//       content.includes("approve")
//     ) {
//       hasUsageContent = true;
//     }
//   });

//   return {
//     hasMultipleFunctionalAreas: functionalAreas.size > 1,
//     functionalAreas: Array.from(functionalAreas),
//     hasMultipleWorkerTypes: workerTypes.size > 1,
//     workerTypes: Array.from(workerTypes),
//     hasBothConfigAndUsage: hasConfigContent && hasUsageContent,
//   };
// }

// // --------------------
// // Enhanced Clarification step
// // --------------------
// async function clarifyIfNeeded(question, hits) {
//   const analysis = analyzeHitsForAmbiguity(hits);

//   const clarifierPrompt = `
// You are a Workday product assistant that decides whether a user question needs clarification.

// Scope:
// - The question is ALWAYS about Workday (any functional area: HCM, Security, Authentication, Time Tracking, Absence, Payroll, etc.).
// - The passages you see come from official Workday documentation.

// The user asked:
// """${question}"""

// We retrieved ${hits.length} passages.

// Context analysis:
// - Multiple functional areas detected: ${analysis.hasMultipleFunctionalAreas}
//   Functional areas found: ${analysis.functionalAreas.join(", ") || "none"}
// - Both configuration and usage content: ${analysis.hasBothConfigAndUsage}
// - Multiple worker types mentioned: ${analysis.hasMultipleWorkerTypes}
//   Worker types found: ${analysis.workerTypes.join(", ") || "none"}

// Your job:
// Ask clarifying questions ONLY if the question is ambiguous in a way that would materially change the answer or the steps.

// Ask clarifying questions if:
// 1. The question could mean different things in different functional areas AND multiple areas were detected
// 2. It's unclear if they want setup/configuration instructions vs. end-user how-to-use instructions AND both types of content were found
// 3. Worker type significantly changes the answer AND multiple worker types were detected
// 4. The question uses vague terms like "assign", "set up", or "configure" that could apply to multiple contexts

// Do NOT ask:
// - Which system or vendor they are using (it's always Workday)
// - About Workday versions (unless docs explicitly show version differences)
// - Overly technical questions that a typical HRIS user wouldn't know

// Good clarifying questions examples:
// ✅ "Are you looking to configure this feature as a system administrator, or learn how to use it as an HR partner?"
// ✅ "Is this for moving individual employees, or for managers with their teams?"
// ✅ "Are you asking about the Change Job business process or the Change Organization Assignments feature?"
// ❌ "Which system are you using?"
// ❌ "What version of Workday do you have?"

// Output:
// Return STRICTLY valid JSON as a single object:

// {
//   "clarifying_questions": ["...", "..."],
//   "detected_ambiguity": "Brief 1-sentence explanation of why clarification is needed, or empty string if not needed"
// }

// If clarification is NOT needed, return:

// {
//   "clarifying_questions": [],
//   "detected_ambiguity": ""
// }
// `;

//   try {
//     const resp = await openai.chat.completions.create({
//       model: "gpt-4o",
//       messages: [{ role: "system", content: clarifierPrompt }],
//       temperature: 0,
//       max_tokens: 300,
//       response_format: { type: "json_object" },
//     });

//     const parsed = safeJSONParse(resp.choices[0].message.content, "clarifier");
//     return {
//       clarifying_questions: parsed?.clarifying_questions || [],
//       detected_ambiguity: parsed?.detected_ambiguity || "",
//     };
//   } catch (err) {
//     console.error("[Clarifier error]", err);
//     return { clarifying_questions: [], detected_ambiguity: "" };
//   }
// }

// // --------------------
// // Enhanced Answer step
// // --------------------
// async function answerWithLLM(question, expanded) {
//   const context = expanded
//     .map(
//       (h, i) =>
//         `Source ${i + 1}${h.documentTitle ? ` [${h.documentTitle}]` : ""} (orderIndex=${h.orderIndex ?? "?"}):\n${h.content}`
//     )
//     .join("\n\n");

//   const answerPrompt = `
// You are a senior Workday consultant with expertise across all functional areas (HCM, Security, Authentication, Time Tracking, Absence, Payroll, etc.).
// Your goal is to provide a **complete, practical, and actionable answer** that an HRIS professional can actually use.

// User question:
// """${question}"""

// Context snippets from official Workday documentation:
// ${context}

// Constraints:
// - Use ONLY what is in the context (or directly implied). If something is not covered, do NOT invent it.
// - If the context is incomplete, say so clearly in the summary and confidence section.
// - Always distinguish between one-time configuration steps (for admins) and ongoing usage steps (for end users).

// Output format:
// Return STRICTLY a single JSON object with this schema:

// {
//   "what_this_does": "1-2 clear sentences explaining what this functionality is and when you'd use it. Make it practical and business-focused.",
  
//   "who_should_do_this": {
//     "one_time_setup": "Specific role(s) needed for initial configuration (e.g., 'Workday System Administrator with tenant configuration access' or 'Implementation Consultant'). If not applicable, say 'Not applicable - no configuration required'.",
//     "ongoing_usage": "Specific role(s) who perform this regularly (e.g., 'HR Partners, HRIS Analysts, Managers with staffing permissions'). If not applicable, say 'Not applicable'."
//   },
  
//   "summary": "2-4 sentences that directly answer the question. Structure it as: 'This allows [WHO] to [DO WHAT] when [SITUATION]. [KEY REQUIREMENT OR PREREQUISITE]. [WHAT HAPPENS OR KEY BEHAVIOR].' Be concrete and actionable.",
  
//   "prerequisites": [
//     "List any required security permissions, tenant settings, business process configurations, or dependencies that must exist BEFORE following the main steps. Each prerequisite should be concrete and specific. If none are mentioned in the context, return empty array."
//   ],
  
//   "configuration_steps": [
//     "One-time setup steps that administrators must configure. Each step should be 2-4 sentences and include:",
//     "- The exact Workday task name in quotes (e.g., 'Edit Tenant Setup - HCM')",
//     "- Navigation hints if available (e.g., 'Access via Business Process menu' or 'Found in Organizations and Roles functional area')",
//     "- WHAT to configure (specific checkboxes, fields, or settings)",
//     "- WHY this step matters (what it enables or prevents)",
//     "If there are no configuration steps in the context, return empty array."
//   ],
  
//   "usage_steps": [
//     "Steps end-users follow to actually USE this feature after configuration. Each step should be 2-4 sentences and include:",
//     "- The exact Workday task name in quotes",
//     "- What users will SEE in the UI (fields, prompts, checkboxes)",
//     "- What CHOICES they need to make",
//     "- What HAPPENS as a result of their action",
//     "If there are no usage steps in the context, return empty array."
//   ],
  
//   "important_notes": [
//     "Key limitations, restrictions, behaviors, or gotchas from the documentation. Examples:",
//     "- 'Cannot reverse this decision without canceling the entire Change Job process'",
//     "- 'Only applies when the manager is moving to a different supervisory organization'",
//     "- 'Teams must be in subordinate organizations within the manager's supervisory hierarchy'",
//     "- 'Requires approval unless approval step is removed from business process'",
//     "Include 3-8 notes if available in context. If none found, return empty array."
//   ],
  
//   "example_scenario": "If the context includes examples, provide ONE concrete real-world scenario showing when/how this would be used. Include specific details. If no examples in context, set to empty string.",
  
//   "related_topics": [
//     "If the context mentions related features, tasks, or business processes, list them here with brief descriptions. Format as: 'Task/Feature Name - Brief description of how it relates'. If none found, return empty array."
//   ],
  
//   "confidence": {
//     "level": "high|medium|low",
//     "reason": "1-2 sentences explaining the confidence level. High = context fully covers the question with clear steps. Medium = context covers main points but missing some details. Low = context is incomplete or only partially relevant."
//   },
  
//   "sources": [
//     "For each source used, format as: 'DocumentTitle (or sourceUri if no title) - Brief description of what information came from this source'",
//     "Be specific about what each source contributed"
//   ]
// }

// Guidelines for creating comprehensive, actionable answers:

// 1. **Task Names**: Always wrap Workday task names in quotes: "Change Job", "Edit Tenant Setup - HCM", "Change Organization Assignments"

// 2. **Completeness**: 
//    - In "configuration_steps" and "usage_steps", include ALL steps mentioned in the context, not just 2-3 high-level bullets
//    - Aim for 5-10 well-explained steps if the context supports it
//    - Each step should be detailed enough that someone could attempt to follow it

// 3. **Prerequisites**: 
//    - Don't bury prerequisites in other steps
//    - Call out security domains, business process configurations, tenant settings upfront
//    - Example: "Business process 'Change Job' must already be configured in your tenant"

// 4. **Configuration vs Usage**:
//    - Clearly separate one-time admin setup from day-to-day user actions
//    - Don't mix them - a user shouldn't think they need admin access for routine tasks
//    - If context only covers one type, that's fine - just leave the other array empty

// 5. **Important Notes**:
//    - These are critical for HRIS professionals to avoid mistakes
//    - Include when something does NOT work, not just when it does
//    - Mention any "gotchas" or non-obvious behaviors
//    - Call out irreversible actions or approval requirements

// 6. **Be Specific**:
//    - "Select the checkbox" → "Select the 'Change Job Default for Move Team with Manager' checkbox"
//    - "Configure the business process" → "Access 'Edit Business Process' and add the 'Change Superior Organization' step after the 'Change Job' completion step"
//    - "Approve the transaction" → "The 'Assign Superior' subprocess requires approval unless you remove the approval step from the business process definition"

// 7. **Structure Each Step Well**:
//    - Start with the action (Access, Configure, Select, Enter, Review)
//    - Include the specific task or location
//    - Explain what to do
//    - Explain why or what happens next

// Remember:
// - Return ONLY valid JSON (no markdown, no commentary, no extra fields)
// - If context doesn't support a section, use empty string or empty array
// - Be honest about confidence level - it's okay to say context is incomplete
// - Every piece of information must be grounded in the provided context
// `;

//   try {
//     const resp = await openai.chat.completions.create({
//       model: "gpt-4o",
//       messages: [{ role: "system", content: answerPrompt }],
//       temperature: 0,
//       max_tokens: 2500, // Increased for comprehensive answers
//       response_format: { type: "json_object" },
//     });

//     const raw = resp.choices[0].message.content;
//     const parsed = safeJSONParse(raw, "answer");

//     if (!parsed) {
//       console.warn("[answerWithLLM] Parse failed, returning fallback JSON");
//       return {
//         what_this_does: "",
//         who_should_do_this: { one_time_setup: "", ongoing_usage: "" },
//         summary: "I found relevant information, but formatting failed. Please try again.",
//         prerequisites: [],
//         configuration_steps: [],
//         usage_steps: [],
//         important_notes: [],
//         example_scenario: "",
//         related_topics: [],
//         confidence: { level: "low", reason: "Response formatting error" },
//         sources: [],
//       };
//     }

//     // Ensure all expected fields exist
//     return {
//       what_this_does: parsed.what_this_does || "",
//       who_should_do_this: parsed.who_should_do_this || { one_time_setup: "", ongoing_usage: "" },
//       summary: parsed.summary || "",
//       prerequisites: parsed.prerequisites || [],
//       configuration_steps: parsed.configuration_steps || [],
//       usage_steps: parsed.usage_steps || [],
//       important_notes: parsed.important_notes || [],
//       example_scenario: parsed.example_scenario || "",
//       related_topics: parsed.related_topics || [],
//       confidence: parsed.confidence || { level: "low", reason: "Incomplete response" },
//       sources: parsed.sources || [],
//     };
//   } catch (err) {
//     console.error("[Answer error]", err);
//     return {
//       what_this_does: "",
//       who_should_do_this: { one_time_setup: "", ongoing_usage: "" },
//       summary: "I found relevant information, but generation failed. Please try again.",
//       prerequisites: [],
//       configuration_steps: [],
//       usage_steps: [],
//       important_notes: [],
//       example_scenario: "",
//       related_topics: [],
//       confidence: { level: "low", reason: "Generation error occurred" },
//       sources: [],
//     };
//   }
// }

// // --------------------
// // Main Ask route
// // --------------------
// router.post("/", async (req, res) => {
//   const start = Date.now();
//   try {
//     const { question } = req.body;
//     if (!question) return res.status(400).json({ ok: false, error: "question_required" });

//     console.log(`🧠 Embedding question: "${question}"`);
//     const qEmbed = await embedText(question);

//     // 1️⃣ Retrieve chunks (increased from 5 to 8 for better context)
//     const hits = await prisma.$queryRaw`
//       SELECT c.id,
//              c.content,
//              c."documentId",
//              d.title        AS "documentTitle",
//              d."sourceUri",
//              c."orderIndex"
//       FROM "Chunk" c
//       JOIN "Document" d ON c."documentId" = d.id
//       ORDER BY c."embeddingVec" <#> ${qEmbed.literal}::vector
//       LIMIT 8;
//     `;

//     console.log(`📚 Retrieved ${hits.length} initial chunks`);

//     // 2️⃣ Expand with neighbors (get more context around each hit)
//     const expanded = [];
//     const seenChunkIds = new Set();

//     for (const h of hits) {
//       // Get 2 chunks before and 2 chunks after for more context
//       const neighbors = await prisma.chunk.findMany({
//         where: { documentId: h.documentId },
//         orderBy: { orderIndex: "asc" },
//         skip: Math.max(h.orderIndex - 2, 0),
//         take: 5, // 2 before + current + 2 after
//       });

//       // Deduplicate chunks
//       neighbors.forEach((chunk) => {
//         if (!seenChunkIds.has(chunk.id)) {
//           seenChunkIds.add(chunk.id);
//           expanded.push(chunk);
//         }
//       });
//     }

//     console.log(`📚 Expanded to ${expanded.length} unique chunks`);

//     // 3️⃣ Enhanced clarification with ambiguity detection
//     const clarification = await clarifyIfNeeded(question, hits);
//     if (clarification.clarifying_questions.length > 0) {
//       console.log("🤔 Clarification needed:", clarification.clarifying_questions);
//       console.log("   Reason:", clarification.detected_ambiguity);
//     }

//     // 4️⃣ Generate comprehensive structured answer
//     const answer = await answerWithLLM(question, expanded);

//     const elapsed = Date.now() - start;

//     // 5️⃣ Return enhanced response
//     res.json({
//       ok: true,
//       hits, // Original top hits for reference
//       expanded, // All chunks used for context
      
//       // Enhanced answer structure
//       what_this_does: answer.what_this_does,
//       who_should_do_this: answer.who_should_do_this,
//       summary: answer.summary,
//       prerequisites: answer.prerequisites,
//       configuration_steps: answer.configuration_steps,
//       usage_steps: answer.usage_steps,
//       important_notes: answer.important_notes,
//       example_scenario: answer.example_scenario,
//       related_topics: answer.related_topics,
//       confidence: answer.confidence,
//       sources: answer.sources,
      
//       // Clarification info
//       clarifying_questions: clarification.clarifying_questions,
//       detected_ambiguity: clarification.detected_ambiguity,
      
//       time: `${elapsed}ms`,
//     });
//   } catch (err) {
//     console.error("[ask error]", err);
//     res.status(500).json({ 
//       ok: false, 
//       error: "ask_failed", 
//       details: err.message 
//     });
//   }
// });

// export default router;


// src/routes/ask.js
import express from "express";
import { prisma } from "../prisma.js";
import { embedText } from "../utils/embeddings.js";

const router = express.Router();

// If you're on Node 18+ you have global fetch.
// If not, uncomment this line and `npm i node-fetch`.
// import fetch from "node-fetch";

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || "http://localhost:11434";
const LLM_MODEL = process.env.LLM_MODEL || "llama3.2:3b";

// --------------------
// Safe JSON Parse (with auto-repair)
// --------------------
function safeJSONParse(raw, label = "unknown") {
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (err) {
    console.warn(`[safeJSONParse] Failed initial parse for ${label}:`, err.message);
    try {
      const fixed = raw
        .replace(/,\s*]/g, "]")
        .replace(/,\s*}/g, "}")
        .replace(/\n/g, " ")
        .trim();
      return JSON.parse(fixed);
    } catch (err2) {
      console.error(
        `[safeJSONParse] Second attempt failed for ${label}:`,
        err2.message
      );
      return null;
    }
  }
}

// --------------------
// Single LLM call - Answer generation (Ollama)
// --------------------
async function answerWithLLM(question, expanded) {
  const context = expanded
    .map(
      (h, i) =>
        `Source ${i + 1}${
          h.documentTitle ? ` [${h.documentTitle}]` : ""
        }:\n${h.content}`
    )
    .join("\n\n");

  const SYSTEM_PROMPT = `
You are a helpful Workday specialist having a conversation with an HRIS professional.
Your goal is to provide clear, practical answers in a conversational but professional tone.

CRITICAL GROUNDING RULES:
- You MUST treat the provided "Context from Workday documentation" as the ONLY source of truth.
- You MUST NOT use any Workday knowledge outside this context (no memory, no training data).
- You MUST NOT invent:
  - Workday task names
  - Navigation paths (like "Edit Tenant Setup - Security > ...")
  - Checkbox/field names
  - Additional document titles or sections
- You may only mention:
  - Task names, fields, checkboxes, and navigation paths that appear VERBATIM in the context.
- If the context doesn't show an exact path or task name, speak GENERICALLY (e.g., "from the authentication policy configuration") instead of fabricating a path.

If something is not in the context, you must either:
- Omit it, or
- Explicitly say "the provided excerpt doesn't show the exact navigation path / task name".
`;

  const USER_PROMPT = `
User question:
"""${question}"""

Context from Workday documentation:
${context}

Return STRICTLY valid JSON with this schema (no extra keys):

{
  "answer": "3-4 sentences that directly address their question in a conversational way. Use 'you' and 'your' to make it personal. Explain what this does and when they'd use it. Be specific about what happens in Workday, but ONLY based on what appears in the context.",
  
  "main_steps": [
    "4-6 key steps, each 1-2 sentences. Only include Workday task names or navigation paths if they appear VERBATIM in the context text above.",
    "If the context doesn't show an exact task or path, describe the step generically (for example: 'From the authentication policy configuration, select the Network Denylist field...') without naming a specific task that isn't in the context."
  ],
  
  "prerequisites": [
    "List any required security permissions, business process configurations, or settings that are explicitly mentioned in the context. Use the exact wording from the doc where possible. If none mentioned, return empty array."
  ],
  
  "important_notes": [
    "3-7 critical limitations, restrictions, or behaviors that are explicitly in the context. Focus on things that would surprise them or block their work.",
    "If none found in the context, return empty array."
  ],
  
  "related_topics": [
    "2-5 related Workday features, tasks, or business processes that are explicitly named in the context. Format as: 'Task/Feature Name - Brief description of how it relates'.",
    "If none found, return empty array."
  ],
  
  "clarification_note": "If the question is ambiguous or could mean different things, provide a brief 1-2 sentence note explaining the ambiguity. If no ambiguity based on the context, return empty string.",
  
  "for_admins": true,
  
  "confidence": {
    "level": "high|medium|low",
    "reason": "1 sentence explaining confidence. High = context fully covers question. Medium = covers main points but missing details. Low = context is incomplete or only partially relevant."
  }
}

ADDITIONAL RULES:
- Respond with ONLY a single JSON object.
- Do NOT wrap the JSON in backticks.
- Do NOT add any explanation before or after the JSON.
- Every field must be present.
- Arrays must be valid JSON arrays.
- Do NOT mention any document titles or sources in this JSON. The caller will handle sources separately.
`;

  try {
    const resp = await fetch(`${OLLAMA_BASE_URL}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: LLM_MODEL,
        stream: false,
        format: "json", // force JSON output from Ollama
        messages: [
          { role: "system", content: SYSTEM_PROMPT },
          { role: "user", content: USER_PROMPT },
        ],
        options: {
          temperature: 0.2,
          num_predict: 600,
        },
      }),
    });

    if (!resp.ok) {
      const text = await resp.text();
      console.error("[Answer error] Ollama HTTP error:", resp.status, text);
      throw new Error(`Ollama error: ${resp.status}`);
    }

    const data = await resp.json();

    let raw = data?.message?.content;
    let parsed;

    if (typeof raw === "string") {
      parsed = safeJSONParse(raw, "answer");
    } else if (typeof raw === "object" && raw !== null) {
      parsed = raw;
    }

    if (!parsed) {
      console.error("[Answer error] Could not parse JSON from LLM:", raw);
      return {
        answer:
          "I found relevant information in the Workday docs, but had trouble formatting the response. Could you rephrase your question?",
        main_steps: [],
        prerequisites: [],
        important_notes: [],
        related_topics: [],
        clarification_note: "",
        for_admins: false,
        confidence: { level: "low", reason: "Response formatting error" },
      };
    }

    return {
      answer: parsed.answer || "",
      main_steps: parsed.main_steps || [],
      prerequisites: parsed.prerequisites || [],
      important_notes: parsed.important_notes || [],
      related_topics: parsed.related_topics || [],
      clarification_note: parsed.clarification_note || "",
      for_admins:
        typeof parsed.for_admins === "boolean" ? parsed.for_admins : true,
      confidence:
        parsed.confidence || {
          level: "low",
          reason: "No confidence provided",
        },
    };
  } catch (err) {
    console.error("[Answer error]", err);
    return {
      answer:
        "I encountered an error processing your question. Please try again or rephrase it.",
      main_steps: [],
      prerequisites: [],
      important_notes: [],
      related_topics: [],
      clarification_note: "",
      for_admins: false,
      confidence: { level: "low", reason: "Generation error" },
    };
  }
}

// --------------------
// Main Ask route
// --------------------
router.post("/", async (req, res) => {
  const start = Date.now();
  try {
    const { question } = req.body;
    if (!question) {
      return res
        .status(400)
        .json({ ok: false, error: "question_required" });
    }

    console.log(`🧠 Question: "${question}"`);
    const qEmbed = await embedText(question);

    // 1️⃣ Retrieve top 5 chunks with cosine distance score
    // NOTE: score here is cosine *distance* (`<#>`), so LOWER = more similar.
    const hits = await prisma.$queryRaw`
      SELECT 
        c.id,
        c.content,
        c."documentId",
        d.title      AS "documentTitle",
        d."sourceUri",
        c."orderIndex",
        (c."embeddingVec" <#> ${qEmbed.literal}::vector) AS "score"
      FROM "Chunk" c
      JOIN "Document" d ON c."documentId" = d.id
      ORDER BY "score" ASC
      LIMIT 5;
    `;

    console.log(`📚 Retrieved ${hits.length} chunks`);

    // 2️⃣ Build doc metadata map
    const docMetaById = new Map();
    hits.forEach((h) => {
      docMetaById.set(h.documentId, {
        documentTitle: h.documentTitle,
        sourceUri: h.sourceUri,
      });
    });

    // 3️⃣ Expand around the top 3 hits (neighbors by orderIndex)
    const expanded = [];
    const seenChunkIds = new Set();
    const topHits = hits.slice(0, 3);

    for (const h of topHits) {
      const neighbors = await prisma.chunk.findMany({
        where: { documentId: h.documentId },
        orderBy: { orderIndex: "asc" },
        skip: Math.max(h.orderIndex - 1, 0),
        take: 3, // previous + current + next
        select: {
          id: true,
          content: true,
          documentId: true,
          orderIndex: true,
        },
      });

      neighbors.forEach((chunk) => {
        if (!seenChunkIds.has(chunk.id)) {
          seenChunkIds.add(chunk.id);
          const meta = docMetaById.get(chunk.documentId) || {};
          expanded.push({
            id: chunk.id,
            content: chunk.content,
            documentId: chunk.documentId,
            orderIndex: chunk.orderIndex,
            documentTitle: meta.documentTitle || null,
            sourceUri: meta.sourceUri || null,
          });
        }
      });
    }

    console.log(`📚 Expanded to ${expanded.length} chunks`);

    // 4️⃣ Generate answer from LLM with RAG context
    const answer = await answerWithLLM(question, expanded);

    const elapsed = Date.now() - start;

    // 5️⃣ Shape hits for client (include score for explainability)
    const hitsForClient = hits.map((h) => ({
      id: h.id,
      content: h.content,
      documentId: h.documentId,
      documentTitle: h.documentTitle,
      sourceUri: h.sourceUri,
      orderIndex: h.orderIndex,
      score: Number(h.score), // cosine distance: lower = closer
    }));

    // 6️⃣ Build sources list from actual chunks (NO LLM hallucination)
    const sourcesMap = new Map();
    expanded.forEach((c) => {
      const key = c.documentId;
      if (!sourcesMap.has(key)) {
        sourcesMap.set(key, {
          documentId: c.documentId,
          title: c.documentTitle,
          sourceUri: c.sourceUri,
        });
      }
    });
    const sources = Array.from(sourcesMap.values());

    // 7️⃣ Return everything (answer + retrieved chunks) for explainability & citations
    res.json({
      ok: true,

      // LLM answer
      answer: answer.answer,
      main_steps: answer.main_steps,
      prerequisites: answer.prerequisites,
      important_notes: answer.important_notes,
      related_topics: answer.related_topics,
      clarification_note: answer.clarification_note,
      for_admins: answer.for_admins,
      confidence: answer.confidence,

      // Retrieval info for frontend explainability
      hits: hitsForClient, // top-k semantic matches with score
      expanded,            // context chunks actually sent to LLM

      // Sources derived from the actual chunks (no hallucination)
      sources,

      time: `${elapsed}ms`,
    });
  } catch (err) {
    console.error("[ask error]", err);
    res.status(500).json({
      ok: false,
      error: "ask_failed",
      details: err.message,
    });
  }
});

export default router;