/** Public marketing image paths (files live under /public/marketing). */
export function marketingImage(fileName: string): string {
  return `/marketing/${encodeURIComponent(fileName)}`;
}

export const marketingImages = {
  heroBg: marketingImage('V2-bg (1).png'),
  heroIllustration: marketingImage('illustration.png'),
  modulesBg: marketingImage('V2-5-modules.png'),
  pipelineCrm: marketingImage('Pipeline CRM.png'),
  smartFactFind: marketingImage('Smart fact find.png'),
  lenderResearch: marketingImage('Lender Research.png'),
  complianceVault: marketingImage('Group.png'),
  aiReport: marketingImage('258726584_9c50a840-de4e-4d0e-b4d3-3d10c7e73295 1.png'),
} as const;
