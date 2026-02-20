import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { controls } from './controls';
import { controls2 } from './controls2';
import { controls3 } from './controls3';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

const trainingModules = [
  { id:'TRN-001',title:'PDPL Foundations for Healthcare',description:'Introduction to PDPL and its healthcare application.',targetRoles:['All staff'],controlsAddressed:['PDPL-C.1','PDPL-G.7','PDPL-R.1','PDPL-R.5'],durationMinutes:20,
    questions:[
      {question:'What is the primary regulatory body overseeing PDPL compliance?',options:['SAMA','SDAIA','MoH','NCA'],correctAnswer:1},
      {question:'Under PDPL, health data is classified as:',options:['General data','Sensitive personal data','Public data','Non-personal data'],correctAnswer:1},
      {question:'How many days to respond to a DSR?',options:['15 days','30 days','60 days','90 days'],correctAnswer:1},
      {question:'Is a DPO mandatory for healthcare organizations?',options:['Only for large hospitals','Yes, for all healthcare orgs','Only if processing minors data','No'],correctAnswer:1},
      {question:'What triggers explicit consent under PDPL?',options:['Any data collection','Only marketing','Sensitive data, credit data, automated decisions','Only cross-border transfers'],correctAnswer:2},
    ]},
  { id:'TRN-002',title:'Patient Consent & Rights',description:'Patient consent requirements including automated decisions and guardian consent.',targetRoles:['compliance_officer','data_steward','department_manager'],controlsAddressed:['HS-PDPL-001','HS-PDPL-002','HS-PDPL-003','PDPL-C.1'],durationMinutes:25,
    questions:[
      {question:'How quickly must processing halt after consent withdrawal in healthcare?',options:['Immediately','Within 24 hours','Within 7 days','Within 30 days'],correctAnswer:1},
      {question:'Can consent be a condition for receiving health services?',options:['Yes always','Only for private hospitals','No, except essential processing','Only with DPO approval'],correctAnswer:2},
      {question:'Who can provide consent for a minor patient?',options:['The minor themselves','Legal guardian','Any family member','Hospital administrator'],correctAnswer:1},
      {question:'How many triggers require explicit consent?',options:['1','2','3','5'],correctAnswer:2},
      {question:'What format should consent records be maintained in?',options:['Verbal only','Written with timestamps','Email only','Any format'],correctAnswer:1},
    ]},
  { id:'TRN-003',title:'Health Data Classification & Labeling',description:'Data classification requirements for health sector.',targetRoles:['data_custodian','data_steward','ciso'],controlsAddressed:['HS-PDPL-008','PDPL-S.4','NCA-D2.R4'],durationMinutes:15,
    questions:[
      {question:'What is the default classification for health data under MoH policy?',options:['Public','Internal','Confidential','Top Secret'],correctAnswer:2},
      {question:'Who is responsible for data classification?',options:['Only IT','Data Steward and Data Custodian','Only the DPO','External auditors'],correctAnswer:1},
      {question:'What must be applied to classified health data?',options:['Nothing special','Health Data tag and labels','Only encryption','Only access controls'],correctAnswer:1},
      {question:'How often should KPIs for classification be monitored?',options:['Never','Annually','Continuously','Only during audits'],correctAnswer:2},
      {question:'Which NCA control covers data classification?',options:['NCA-D1.R1','NCA-D2.R4','NCA-D3.R1','NCA-D4.R1'],correctAnswer:1},
    ]},
  { id:'TRN-004',title:'Data Security, Access Control & Task Segregation',description:'Security controls including task segregation for health data.',targetRoles:['ciso','data_custodian'],controlsAddressed:['PDPL-S.1','PDPL-S.2','PDPL-S.3','HS-PDPL-021a','HS-PDPL-021b'],durationMinutes:30,
    questions:[
      {question:'What does task segregation require for health data?',options:['One person handles everything','Distribute tasks to prevent overlapping','Only IT handles data','Outsource to vendors'],correctAnswer:1},
      {question:'What encryption standard is required at rest?',options:['DES','AES-128','AES-256','No encryption needed'],correctAnswer:2},
      {question:'What is the minimum TLS version required?',options:['TLS 1.0','TLS 1.1','TLS 1.2','TLS 1.3'],correctAnswer:3},
      {question:'How quickly must critical vulnerabilities be patched?',options:['30 days','14 days','7 days','72 hours'],correctAnswer:3},
      {question:'What must HS-PDPL-021b document?',options:['Only security policies','All stages of health data processing with named responsible persons','Only breach procedures','Only access controls'],correctAnswer:1},
    ]},
  { id:'TRN-005',title:'Breach Response',description:'Breach notification procedures including patient notification.',targetRoles:['dpo','ciso','data_custodian'],controlsAddressed:['PDPL-B.1','PDPL-B.2','HS-PDPL-014','HS-PDPL-015'],durationMinutes:25,
    questions:[
      {question:'How many hours to notify SDAIA of a breach?',options:['24 hours','48 hours','72 hours','7 days'],correctAnswer:2},
      {question:'How many mandatory fields in SDAIA breach notification?',options:['3','4','5','7'],correctAnswer:2},
      {question:'Patient breach notification must include:',options:['Technical details only','Recommendations/advice to protect themselves','Nothing specific','Legal citations only'],correctAnswer:1},
      {question:'In what language must patient notifications be provided?',options:['English only','Arabic only','Simple Arabic','Any language'],correctAnswer:2},
      {question:'What is mandatory field 4 of data subject notification?',options:['Technical incident report','Recommendations/advice for self-protection','Legal disclaimer','Insurance information'],correctAnswer:1},
    ]},
  { id:'TRN-006',title:'DSR Fulfillment (30+30 Day Framework)',description:'Data subject request handling with timelines.',targetRoles:['dpo','compliance_officer','data_steward'],controlsAddressed:['PDPL-R.1','PDPL-R.5','HS-PDPL-004','HS-PDPL-005'],durationMinutes:20,
    questions:[
      {question:'Maximum initial DSR response time?',options:['15 days','30 days','45 days','60 days'],correctAnswer:1},
      {question:'Maximum total DSR response time with extension?',options:['30 days','45 days','60 days','90 days'],correctAnswer:2},
      {question:'What is required for a DSR extension?',options:['Nothing','Advance written notice to data subject with reasons','DPO approval only','SDAIA approval'],correctAnswer:1},
      {question:'How should oral DSRs be handled?',options:['Ignored','Documented in central register same as written','Referred to written form','Rejected'],correctAnswer:1},
      {question:'When can a DSR be refused?',options:['Anytime','When repetitive, unfounded, or disproportionate','Never','Only with court order'],correctAnswer:1},
    ]},
  { id:'TRN-007',title:'Vendor & Third-Party Management',description:'DPA requirements with 9 mandatory clauses.',targetRoles:['dpo','compliance_officer'],controlsAddressed:['PDPL-T.1','PDPL-T.3','HS-PDPL-016'],durationMinutes:20,
    questions:[
      {question:'How many mandatory clauses in a PDPL DPA?',options:['5','7','9','12'],correctAnswer:2},
      {question:'Must sub-processors get prior written approval?',options:['No','Only for cloud providers','Yes, from the controller','Only for cross-border'],correctAnswer:2},
      {question:'What must DPAs disclose about foreign regulations?',options:['Nothing','Whether processor is subject to other countries regulations and impact on PDPL','Only EU regulations','Only US regulations'],correctAnswer:1},
      {question:'How often should processor compliance be monitored?',options:['Never','Monthly','Annually','Only at contract renewal'],correctAnswer:2},
      {question:'What must breach notification in DPAs specify?',options:['Approximate timeline','Channel, format, and without undue delay','Only email notification','Nothing specific'],correctAnswer:1},
    ]},
  { id:'TRN-008',title:'Cross-Border Transfer (SDAIA SCCs)',description:'Transfer framework including TRA requirements.',targetRoles:['dpo'],controlsAddressed:['PDPL-T.5','PDPL-T.8','PDPL-T.9'],durationMinutes:25,
    questions:[
      {question:'What type of SCCs must be used for cross-border transfers?',options:['GDPR SCCs','Any SCCs','SDAIA standard model SCCs','Custom SCCs'],correctAnswer:2},
      {question:'How many mandatory transfer suspension triggers exist?',options:['2','3','4','6'],correctAnswer:2},
      {question:'Is a Transfer Risk Assessment required?',options:['Only for EU transfers','For all cross-border transfers','Only for large volumes','Never'],correctAnswer:1},
      {question:'What approval is needed for health data transfers outside KSA?',options:['DPO approval only','NDMO/NCA written approval','No approval needed','SAMA approval'],correctAnswer:1},
      {question:'When must transfers be immediately suspended?',options:['When costs are high','When national security is affected or safeguards fail','When contract expires','Never'],correctAnswer:1},
    ]},
  { id:'TRN-009',title:'DPIA Process — 7 Triggers',description:'All 7 DPIA triggers under Reg. Art. 25(1).',targetRoles:['dpo','ciso'],controlsAddressed:['PDPL-G.3','HS-PDPL-020'],durationMinutes:30,
    questions:[
      {question:'How many DPIA triggers exist under Reg. Art. 25(1)?',options:['3','5','7','10'],correctAnswer:2},
      {question:'Do all healthcare orgs trigger DPIA?',options:['No','Only large hospitals','Yes, via sensitive data processing (Trigger 1)','Only if using AI'],correctAnswer:2},
      {question:'What must happen if DPIA shows unmitigated high risk?',options:['Proceed anyway','Consult SDAIA','Cancel processing','Nothing'],correctAnswer:1},
      {question:'Which trigger covers AI/ML processing?',options:['Trigger 1','Trigger 3','Trigger 5 and 6','Trigger 7'],correctAnswer:2},
      {question:'What template should health orgs use for DPIA?',options:['GDPR template','MoH DPIA template','Any template','No template needed'],correctAnswer:1},
    ]},
  { id:'TRN-010',title:'PDPL for Executives & Board',description:'Board-level accountability and DPO requirements.',targetRoles:['org_admin'],controlsAddressed:['PDPL-G.1','PDPL-G.3','PDPL-G.14','PDPL-B.1'],durationMinutes:15,
    questions:[
      {question:'What is the DPO risk level for healthcare organizations?',options:['LOW','MEDIUM','HIGH','CRITICAL'],correctAnswer:3},
      {question:'How many DPO appointment triggers exist?',options:['1','2','3','5'],correctAnswer:2},
      {question:'Which trigger makes DPO mandatory for ALL health orgs?',options:['Trigger A - public entity','Trigger B - monitoring','Trigger C - sensitive data','None'],correctAnswer:2},
      {question:'What is the board primary accountability for PDPL?',options:['Technical implementation','Overall compliance and DPO appointment','Training delivery','Breach response only'],correctAnswer:1},
      {question:'Can a health organization operate without a DPO?',options:['Yes if small','Yes with SDAIA waiver','No, never for health orgs','Yes if no breaches'],correctAnswer:2},
    ]},
  { id:'TRN-011',title:'Research Data & Special Processing',description:'Pseudonymization, anonymization, and research data requirements.',targetRoles:['data_steward','dpo'],controlsAddressed:['PDPL-SP.1','PDPL-SP.2'],durationMinutes:20,
    questions:[
      {question:'What standard must anonymization meet?',options:['Difficult to re-identify','Impossible to re-identify','Unlikely to re-identify','Reasonably difficult'],correctAnswer:1},
      {question:'What principle applies to research data?',options:['Collect everything possible','Data minimization - minimum necessary','No restrictions','Only anonymized data'],correctAnswer:1},
      {question:'Must anonymization effectiveness be evaluated?',options:['No','Only once','Periodically','Only if breach occurs'],correctAnswer:2},
      {question:'Can pseudonymized data be used without consent?',options:['Yes always','Only for research with safeguards','Never','Only with SDAIA approval'],correctAnswer:1},
      {question:'What does Reg. Art. 9 require for anonymization?',options:['Simple masking','Re-identification must be impossible','Only encryption','No specific requirement'],correctAnswer:1},
    ]},
  { id:'TRN-012',title:'Employee Confidentiality & Exit Procedures',description:'Staff confidentiality obligations and exit procedures.',targetRoles:['All staff','org_admin'],controlsAddressed:['PDPL-G.6','PDPL-TR.3'],durationMinutes:15,
    questions:[
      {question:'Do confidentiality obligations continue after employment ends?',options:['No','Only for 1 year','Yes, per PDPL Art. 41','Only for senior staff'],correctAnswer:2},
      {question:'What document binds employees to confidentiality?',options:['Email agreement','NDA and employment contract','Verbal agreement','Nothing required'],correctAnswer:1},
      {question:'What must happen at employee exit regarding data?',options:['Nothing','Revoke all access, return/destroy data, exit interview','Only disable email','Only change passwords'],correctAnswer:1},
      {question:'How often must awareness training be renewed?',options:['Never','Every 2 years','Annually','Every 6 months'],correctAnswer:2},
      {question:'Who is responsible for ensuring confidentiality obligations?',options:['Only HR','DPO and Organization Admin','Only the employee','External auditors'],correctAnswer:1},
    ]},
];

async function seed() {
  console.log('🌱 Seeding database...');

  await prisma.auditLog.deleteMany();
  await prisma.trainingRecord.deleteMany();
  await prisma.evidenceFile.deleteMany();
  await prisma.remediationTask.deleteMany();
  await prisma.response.deleteMany();
  await prisma.assessment.deleteMany();
  await prisma.user.deleteMany();
  await prisma.organization.deleteMany();
  await prisma.control.deleteMany();
  await prisma.trainingModule.deleteMany();

  console.log('Cleared existing data');

  // Seed controls
  const allControls = [...controls, ...controls2, ...controls3];
  for (const c of allControls) {
    await prisma.control.create({
      data: {
        id: c.id, source: c.source, domainNumber: c.domainNumber, domainName: c.domainName,
        ref: c.ref, objectiveEn: c.objectiveEn,
        pdplArticles: (c as any).pdplArticles || null,
        regArticles: (c as any).regArticles || null,
        transferRegArticles: (c as any).transferRegArticles || null,
        ncaRef: (c as any).ncaRef || null,
        mohPolicyRef: (c as any).mohPolicyRef || null,
        riskLevel: c.riskLevel, pointsYes: c.pointsYes, pointsPartial: c.pointsPartial,
        evidenceGuidanceEn: c.evidenceGuidanceEn || null,
        mohImplGuidanceEn: (c as any).mohPolicyRef ? `Implement per MoH: ${c.objectiveEn}` : null,
        responsibleRoles: c.responsibleRoles || [],
        mandatoryForTypes: (c as any).mandatoryForTypes || [],
        conditionalOn: (c as any).conditionalOn || null,
        weightMultiplier: c.weightMultiplier || 1.0,
        trainingModuleIds: c.trainingModuleIds || [],
      },
    });
  }
  console.log(`✅ Seeded ${allControls.length} controls`);

  // Seed training modules
  for (const m of trainingModules) {
    await prisma.trainingModule.create({
      data: {
        id: m.id, title: m.title, description: m.description,
        targetRoles: m.targetRoles, controlsAddressed: m.controlsAddressed,
        durationMinutes: m.durationMinutes, passScore: 80, maxAttempts: 3,
        content: { slides: [`Welcome to ${m.title}`, 'Learning Objectives', 'Key Concepts', 'Regulatory Requirements', 'Health Sector Application', 'Practical Scenarios', 'Summary & Key Takeaways'] },
        questions: m.questions,
      },
    });
  }
  console.log(`✅ Seeded ${trainingModules.length} training modules`);

  // Seed demo organization and admin user
  const org = await prisma.organization.create({
    data: {
      name: 'Demo Healthcare Organization',
      orgType: 'private_hospital',
      bedCount: 200,
      staffSize: 500,
      regionsOfOperation: ['Riyadh'],
      processesMinors: true,
      crossBorderTransfers: false,
      usesCloud: 'yes',
      conductsResearch: false,
      usesAiOrAutomatedDecisions: false,
      continuousMonitoring: false,
      dpoAppointed: true,
      dpoName: 'Dr. Ahmad Al-Rashid',
      dpoEmail: 'dpo@demo-hospital.sa',
      applicableRegulatoryBodies: ['moh', 'nca'],
      subscriptionTier: 'professional',
      onboardingCompleted: true,
    },
  });

  const passwordHash = await bcrypt.hash('Admin@12345678', 12);
  await prisma.user.create({
    data: {
      email: 'admin@demo-hospital.sa',
      passwordHash,
      firstName: 'Admin',
      lastName: 'User',
      role: 'org_admin',
      orgId: org.id,
    },
  });

  const dpoHash = await bcrypt.hash('Dpo@123456789', 12);
  await prisma.user.create({
    data: {
      email: 'dpo@demo-hospital.sa',
      passwordHash: dpoHash,
      firstName: 'Ahmad',
      lastName: 'Al-Rashid',
      role: 'dpo',
      orgId: org.id,
    },
  });

  console.log('✅ Seeded demo organization and users');
  console.log('  Email: admin@demo-hospital.sa / Password: Admin@12345678');
  console.log('  Email: dpo@demo-hospital.sa / Password: Dpo@123456789');
  console.log('🎉 Seeding complete!');
}

seed()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
