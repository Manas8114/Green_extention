/**
 * Utilities for parsing and formatting analysis responses
 */

/**
 * Formats the label for display in UI
 * @param {string} label - Analysis label
 * @returns {Object} Object with formatted label and CSS class
 */
export function formatLabel(label) {
  const labels = {
    'Eco-Friendly': {
      display: 'Eco-Friendly',
      class: 'eco-friendly',
      color: '#10b981'
    },
    'Moderate': {
      display: 'Moderate',
      class: 'moderate',
      color: '#f59e0b'
    },
    'Not Eco-Friendly': {
      display: 'Not Eco-Friendly',
      class: 'not-eco-friendly',
      color: '#ef4444'
    }
  };
  
  return labels[label] || labels['Moderate'];
}

/**
 * Formats the confidence percentage
 * @param {number} confidence - Confidence (0-100)
 * @returns {string} Formatted percentage
 */
export function formatConfidence(confidence) {
  return `${Math.round(confidence)}%`;
}

/**
 * Formats the breakdown for display in UI
 * @param {Object} explanation - Analysis explanation object
 * @returns {Array} Array of formatted objects for display
 */
export function formatBreakdown(explanation) {
  const breakdown = [
    {
      title: 'Carbon Footprint',
      key: 'carbon_footprint',
      value: explanation.carbon_footprint || 'Not available',
      icon: '🌍'
    },
    {
      title: 'Recyclability',
      key: 'recyclability',
      value: explanation.recyclability || 'Not available',
      icon: '♻️'
    },
    {
      title: 'Toxicity',
      key: 'toxicity',
      value: explanation.toxicity || 'Not available',
      icon: '⚠️'
    },
    {
      title: 'Durability',
      key: 'durability',
      value: explanation.durability || 'Not available',
      icon: '⏳'
    },
    {
      title: 'Certifications',
      key: 'certifications',
      value: explanation.certifications_found || [],
      icon: '✅',
      isList: true
    },
    {
      title: 'Greenwashing Risk',
      key: 'greenwashing_risk',
      value: explanation.greenwashing_risk || 'Not available',
      icon: '🔍'
    }
  ];
  
  return breakdown;
}

/**
 * Validates that the analysis has the correct structure
 * @param {Object} analysis - Analysis object
 * @returns {boolean} True if valid
 */
export function validateAnalysis(analysis) {
  return (
    analysis &&
    typeof analysis === 'object' &&
    analysis.label &&
    typeof analysis.confidence === 'number' &&
    analysis.explanation &&
    typeof analysis.explanation === 'object'
  );
}

