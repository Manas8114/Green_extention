/**
 * Scraper to extract lightweight product information
 * Does NOT extract images, only relevant text
 */

/**
 * Extracts product data from current page
 * @returns {Object} Extracted product data
 */
export function scrapeProductData() {
  const data = {
    title: extractTitle(),
    description: extractDescription(),
    bulletPoints: extractBulletPoints(),
    ingredients: extractIngredients(),
    materials: extractMaterials(),
    packaging: extractPackaging(),
    certifications: extractCertifications(),
    sustainability: extractSustainabilityNotes(),
    url: window.location.href
  };
  
  // Clean and combine all text
  const cleanedText = cleanAndCombineText(data);
  
  return {
    raw: data,
    cleanedText: cleanedText
  };
}

/**
 * Extracts product title
 */
function extractTitle() {
  const selectors = [
    'h1[itemprop="name"]',
    'h1.product-title',
    'h1.product-name',
    'h1#product-title',
    '[data-product-title]',
    'h1'
  ];
  
  for (const selector of selectors) {
    const element = document.querySelector(selector);
    if (element && element.textContent.trim()) {
      return element.textContent.trim();
    }
  }
  
  return '';
}

/**
 * Extracts product description
 */
function extractDescription() {
  const selectors = [
    '[itemprop="description"]',
    '.product-description',
    '#product-description',
    '[data-product-description]',
    '.product-details',
    '#product-details'
  ];
  
  let description = '';
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      const text = el.textContent.trim();
      if (text && text.length > description.length) {
        description = text;
      }
    });
  }
  
  // If we don't find specific description, search for paragraphs near the title
  if (!description) {
    const title = document.querySelector('h1');
    if (title) {
      const nextSibling = title.nextElementSibling;
      if (nextSibling && nextSibling.tagName === 'P') {
        description = nextSibling.textContent.trim();
      }
    }
  }
  
  return description;
}

/**
 * Extracts key points/bullet points
 */
function extractBulletPoints() {
  const bullets = [];
  const selectors = [
    'ul.product-features li',
    'ul.features li',
    'ul.bullets li',
    '[data-features] li',
    '.product-specs li',
    'ul li'
  ];
  
  for (const selector of selectors) {
    const elements = document.querySelectorAll(selector);
    elements.forEach(el => {
      const text = el.textContent.trim();
      // Filter very long bullets (probably not product bullets)
      if (text && text.length < 200 && !bullets.includes(text)) {
        bullets.push(text);
      }
    });
    
    // Limit to first 10 most relevant bullets
    if (bullets.length >= 10) break;
  }
  
  return bullets.slice(0, 10);
}

/**
 * Extracts ingredients or components
 * Optimized to avoid loading entire body.textContent into memory
 */
function extractIngredients() {
  const keywords = ['ingredients', 'ingredientes', 'components', 'componentes', 'contains'];
  const ingredients = [];
  
  // Search in specific elements first to avoid loading entire body
  const searchElements = [
    ...document.querySelectorAll('[itemprop="ingredients"]'),
    ...document.querySelectorAll('.ingredients, #ingredients, [data-ingredients]'),
    document.body
  ];
  
  keywords.forEach(keyword => {
    if (ingredients.length >= 3) return; // Limit results
    
    for (const element of searchElements) {
      if (!element || !element.textContent) continue;
      
      try {
        const regex = new RegExp(`${keyword}[\\s:]+([^\\n]{50,500})`, 'i');
        const match = element.textContent.match(regex);
        if (match && match[1]) {
          const ingredient = match[1].trim();
          if (ingredient && !ingredients.includes(ingredient)) {
            ingredients.push(ingredient);
            break; // Found one, move to next keyword
          }
        }
      } catch (e) {
        // Continue if regex error
        continue;
      }
    }
  });
  
  return ingredients.join(' ').substring(0, 500); // Limit size
}

/**
 * Extracts material information
 * Optimized to avoid memory problems
 */
function extractMaterials() {
  const keywords = ['material', 'materials', 'made of', 'fabricado', 'materiales'];
  const materials = [];
  
  // Search in specific elements first
  const searchElements = [
    ...document.querySelectorAll('[itemprop="material"]'),
    ...document.querySelectorAll('.materials, #materials, [data-material], [data-materials]'),
    document.body
  ];
  
  keywords.forEach(keyword => {
    if (materials.length >= 5) return; // Limit results
    
    for (const element of searchElements) {
      if (!element || !element.textContent) continue;
      
      try {
        const regex = new RegExp(`${keyword}[\\s:]+([^\\n]{20,300})`, 'i');
        const match = element.textContent.match(regex);
        if (match && match[1]) {
          const material = match[1].trim();
          if (material && !materials.includes(material)) {
            materials.push(material);
            break;
          }
        }
      } catch (e) {
        continue;
      }
    }
  });
  
  // Also search in data-* attributes
  const dataElements = document.querySelectorAll('[data-material], [data-materials]');
  const maxDataElements = Math.min(dataElements.length, 10); // Limit to 10 elements
  for (let i = 0; i < maxDataElements; i++) {
    const el = dataElements[i];
    const material = el.getAttribute('data-material') || el.getAttribute('data-materials');
    if (material && !materials.includes(material)) {
      materials.push(material);
    }
  }
  
  return materials.join(' ').substring(0, 500); // Limit size
}

/**
 * Extracts packaging information
 */
function extractPackaging() {
  const keywords = ['packaging', 'empaque', 'embalaje', 'package', 'wrapping'];
  const packaging = [];
  
  keywords.forEach(keyword => {
    const regex = new RegExp(`${keyword}[\\s:]+([^\\n]{20,300})`, 'i');
    const match = document.body.textContent.match(regex);
    if (match && match[1]) {
      packaging.push(match[1].trim());
    }
  });
  
  return packaging.join(' ');
}

/**
 * Extracts environmental certifications
 * Optimized to avoid loading entire body into memory
 */
function extractCertifications() {
  const certifications = [];
  const certKeywords = [
    'organic', 'orgánico',
    'fair trade', 'comercio justo',
    'fsc', 'forest stewardship',
    'leed', 'energy star',
    'usda organic', 'eu organic',
    'carbon neutral', 'carbono neutral',
    'b-corp', 'b corp',
    'cradle to cradle', 'c2c',
    'greenguard', 'eco-label',
    'recycled', 'reciclado',
    'biodegradable'
  ];
  
  // Search in relevant sections first
  const specificElements = document.querySelectorAll('.certifications, #certifications, [data-certifications]');
  const generalElements = document.querySelectorAll('p, div, span, li');
  
  // Limit general elements to first 30 to avoid memory problems
  const limitedGeneral = Array.from(generalElements).slice(0, 30);
  const searchElements = [...specificElements, ...limitedGeneral];
  
  // Limit search to first 50 elements total to avoid memory problems
  const limitedElements = searchElements.slice(0, 50);
  const searchText = limitedElements
    .map(el => el.textContent || '')
    .join(' ')
    .toLowerCase();
  
  certKeywords.forEach(keyword => {
    if (searchText.includes(keyword.toLowerCase()) && !certifications.includes(keyword)) {
      certifications.push(keyword);
    }
  });
  
  return certifications.slice(0, 10); // Limit to 10 certifications
}

/**
 * Extracts sustainability notes
 * Optimized to avoid memory problems
 */
function extractSustainabilityNotes() {
  const keywords = ['sustainable', 'sostenible', 'eco-friendly', 'ecológico', 'green', 'verde', 'environment', 'medio ambiente'];
  const notes = [];
  
  // Search in relevant paragraphs and divs (not entire body)
  const searchElements = [
    ...document.querySelectorAll('.sustainability, #sustainability, [data-sustainability]'),
    ...document.querySelectorAll('p, .description, .product-info'),
    document.body
  ];
  
  // Limit to first 30 elements
  const limitedElements = searchElements.slice(0, 30);
  
  keywords.forEach(keyword => {
    if (notes.length >= 3) return; // Maximum 3 mentions total
    
    for (const element of limitedElements) {
      if (!element || !element.textContent) continue;
      
      try {
        const regex = new RegExp(`[^.]*${keyword}[^.]*\\.`, 'gi');
        const matches = element.textContent.match(regex);
        if (matches) {
          matches.slice(0, 1).forEach(match => {
            if (!notes.includes(match.trim())) {
              notes.push(match.trim());
            }
          });
          break; // Found a mention, move to next keyword
        }
      } catch (e) {
        continue;
      }
    }
  });
  
  return notes.join(' ').substring(0, 300); // Limit size
}

/**
 * Cleans and combines all extracted text
 */
function cleanAndCombineText(data) {
  const parts = [];
  
  if (data.title) parts.push(`Title: ${data.title}`);
  if (data.description) parts.push(`Description: ${data.description}`);
  if (data.bulletPoints.length > 0) {
    parts.push(`Features: ${data.bulletPoints.join('; ')}`);
  }
  if (data.ingredients) parts.push(`Ingredients: ${data.ingredients}`);
  if (data.materials) parts.push(`Materials: ${data.materials}`);
  if (data.packaging) parts.push(`Packaging: ${data.packaging}`);
  if (data.certifications.length > 0) {
    parts.push(`Certifications found: ${data.certifications.join(', ')}`);
  }
  if (data.sustainability) parts.push(`Sustainability notes: ${data.sustainability}`);
  
  // Clean HTML tags, scripts, and unnecessary content
  let combined = parts.join('\n\n');
  
  // Remove HTML tags
  combined = combined.replace(/<[^>]*>/g, '');
  
  // Remove scripts and styles
  combined = combined.replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '');
  combined = combined.replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '');
  
  // Clean multiple spaces
  combined = combined.replace(/\s+/g, ' ').trim();
  
  // Limit total length (maximum 5000 characters for efficiency)
  if (combined.length > 5000) {
    combined = combined.substring(0, 5000) + '...';
  }
  
  return combined;
}

