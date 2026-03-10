const fs = require('fs');
const config = $('Set Configuration').first().json.config;

// Check file mount and inputs
try {
  if (!fs.existsSync(config.EXCEL_FILE)) {
    throw new Error(`Excel file not found at: ${config.EXCEL_FILE}`);
  }
  if (!fs.existsSync(config.SOURCE_PDF_DIR)) {
    throw new Error(`PDF Source directory not found at: ${config.SOURCE_PDF_DIR}`);
  }
  
  const files = fs.readdirSync(config.SOURCE_PDF_DIR);
  
  // Check write permission to log path
  fs.writeFileSync(`${config.LOG_PATH}/.preflight_ok`, new Date().toISOString());
  
  // Grab categories out of the previous node (Fetch Categories) if available
  // otherwise use fallback array
  let categories = ['Correspondence','RFA','Drawing','Transmittal','Report','Other'];
  try {
    const upstreamData = $('Fetch Categories').first()?.json?.data;
    if (upstreamData && Array.isArray(upstreamData)) {
        categories = upstreamData.map(c => c.name || c.type || c); // very loose mapping depending on API response
    }
  } catch(e) {}
  
  // Grab existing tags from Fetch Tags node
  let existingTags = [];
  try {
    const tagData = $('Fetch Tags').first()?.json?.data || [];
    existingTags = Array.isArray(tagData) ? tagData.map(t => t.tag_name || t.name || '').filter(Boolean) : [];
  } catch(e) {}
    
  return [{ json: { 
    preflight_ok: true, 
    pdf_count_in_source: files.length,
    excel_target: config.EXCEL_FILE,
    system_categories: categories,
    existing_tags: existingTags,
    timestamp: new Date().toISOString()
  }}];
} catch (err) {
  throw new Error(`Pre-flight check failed: ${err.message}`);
}