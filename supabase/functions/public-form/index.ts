import { createClient } from "npm:@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

const COUNTRY_CODES = [
  { code: "55", name: "Brasil", flag: "🇧🇷" },
  { code: "1", name: "Estados Unidos", flag: "🇺🇸" },
  { code: "54", name: "Argentina", flag: "🇦🇷" },
  { code: "56", name: "Chile", flag: "🇨🇱" },
  { code: "57", name: "Colômbia", flag: "🇨🇴" },
  { code: "51", name: "Peru", flag: "🇵🇪" },
  { code: "598", name: "Uruguai", flag: "🇺🇾" },
  { code: "595", name: "Paraguai", flag: "🇵🇾" },
  { code: "591", name: "Bolívia", flag: "🇧🇴" },
  { code: "58", name: "Venezuela", flag: "🇻🇪" },
  { code: "593", name: "Equador", flag: "🇪🇨" },
  { code: "34", name: "Espanha", flag: "🇪🇸" },
  { code: "351", name: "Portugal", flag: "🇵🇹" },
  { code: "39", name: "Itália", flag: "🇮🇹" },
  { code: "33", name: "França", flag: "🇫🇷" },
  { code: "49", name: "Alemanha", flag: "🇩🇪" },
  { code: "44", name: "Reino Unido", flag: "🇬🇧" },
  { code: "81", name: "Japão", flag: "🇯🇵" },
  { code: "86", name: "China", flag: "🇨🇳" },
  { code: "91", name: "Índia", flag: "🇮🇳" },
  { code: "82", name: "Coreia do Sul", flag: "🇰🇷" },
  { code: "52", name: "México", flag: "🇲🇽" },
  { code: "61", name: "Austrália", flag: "🇦🇺" },
  { code: "27", name: "África do Sul", flag: "🇿🇦" },
  { code: "971", name: "Emirados Árabes", flag: "🇦🇪" },
  { code: "966", name: "Arábia Saudita", flag: "🇸🇦" },
  { code: "7", name: "Rússia", flag: "🇷🇺" },
  { code: "380", name: "Ucrânia", flag: "🇺🇦" },
  { code: "48", name: "Polônia", flag: "🇵🇱" },
  { code: "31", name: "Holanda", flag: "🇳🇱" },
  { code: "32", name: "Bélgica", flag: "🇧🇪" },
  { code: "41", name: "Suíça", flag: "🇨🇭" },
  { code: "43", name: "Áustria", flag: "🇦🇹" },
  { code: "46", name: "Suécia", flag: "🇸🇪" },
  { code: "47", name: "Noruega", flag: "🇳🇴" },
  { code: "45", name: "Dinamarca", flag: "🇩🇰" },
  { code: "358", name: "Finlândia", flag: "🇫🇮" },
  { code: "353", name: "Irlanda", flag: "🇮🇪" },
  { code: "30", name: "Grécia", flag: "🇬🇷" },
  { code: "90", name: "Turquia", flag: "🇹🇷" },
  { code: "972", name: "Israel", flag: "🇮🇱" },
  { code: "20", name: "Egito", flag: "🇪🇬" },
  { code: "234", name: "Nigéria", flag: "🇳🇬" },
  { code: "254", name: "Quênia", flag: "🇰🇪" },
  { code: "60", name: "Malásia", flag: "🇲🇾" },
  { code: "65", name: "Singapura", flag: "🇸🇬" },
  { code: "66", name: "Tailândia", flag: "🇹🇭" },
  { code: "84", name: "Vietnã", flag: "🇻🇳" },
  { code: "63", name: "Filipinas", flag: "🇵🇭" },
  { code: "62", name: "Indonésia", flag: "🇮🇩" },
  { code: "64", name: "Nova Zelândia", flag: "🇳🇿" },
];

function generateCountryOptionsHTML(): string {
  return COUNTRY_CODES.map(country => 
    `<option value="${country.code}" ${country.code === '55' ? 'selected' : ''}>
      ${country.flag} +${country.code}
    </option>`
  ).join('');
}

Deno.serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const staticParamsJson = url.searchParams.get('static_params');
    const embed = url.searchParams.get('embed') === 'true';
    const originUrl = req.headers.get('origin') || req.headers.get('referer')?.replace(/\/$/, '') || 'https://clever-qr-share.lovable.app';

    if (!slug) {
      return new Response(
        JSON.stringify({ error: 'Slug é obrigatório' }),
        { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      );
    }

    // Parse static params
    let staticParams: { key: string; value: string }[] = [];
    if (staticParamsJson) {
      try {
        staticParams = JSON.parse(staticParamsJson);
      } catch (e) {
        console.log('Error parsing static params:', e);
      }
    }

    const supabaseUrl = Deno.env.get('SUPABASE_URL')!;
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Fetch form by slug
    const { data: form, error: formError } = await supabase
      .from('forms')
      .select('*')
      .eq('slug', slug)
      .eq('status', 'published')
      .single();

    if (formError || !form) {
      const html = `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Formulário não encontrado</title>
  <style>
    body { font-family: Inter, sans-serif; display: flex; align-items: center; justify-content: center; min-height: 100vh; margin: 0; background: #f5f5f5; }
    .container { text-align: center; padding: 2rem; }
    h1 { color: #333; margin-bottom: 1rem; }
    p { color: #666; }
  </style>
</head>
<body>
  <div class="container">
    <h1>Formulário não encontrado</h1>
    <p>Este formulário não existe ou não está mais disponível.</p>
  </div>
</body>
</html>`;
      return new Response(html, { 
        status: 404, 
        headers: { 
          'Content-Type': 'text/html; charset=utf-8',
          'Access-Control-Allow-Origin': '*',
        } 
      });
    }

    // Fetch form fields
    const { data: fields, error: fieldsError } = await supabase
      .from('form_fields')
      .select('*')
      .eq('form_id', form.id)
      .order('position');

    if (fieldsError) {
      console.error('Error fetching fields:', fieldsError);
    }

    const formFields = fields || [];

    // Generate form HTML with static params and embed mode
    const html = generateFormHTML(form, formFields, staticParams, embed, originUrl);

    return new Response(html, {
      headers: { 
        'Content-Type': 'text/html; charset=utf-8',
        'Access-Control-Allow-Origin': '*',
      },
    });

  } catch (error) {
    console.error('Error in public-form:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateFormHTML(form: any, fields: any[], staticParams: { key: string; value: string }[], embed: boolean = false, originUrl: string = ''): string {
  const fieldsHTML = fields
    .filter(f => !['heading', 'paragraph', 'divider'].includes(f.field_type) || f.field_type === 'heading' || f.field_type === 'paragraph' || f.field_type === 'divider')
    .map(field => generateFieldHTML(field))
    .join('\n');

  // Generate hidden fields for static params
  const staticParamsHTML = staticParams
    .map(p => `<input type="hidden" name="_static_${escapeHtml(p.key)}" value="${escapeHtml(p.value)}">`)
    .join('\n');

  // Conditional styles for embed mode
  const bodyStyles = embed 
    ? `font-family: var(--font-family); background: transparent; min-height: auto; padding: 0;`
    : `font-family: var(--font-family); background: var(--bg-color); min-height: 100vh; display: flex; align-items: center; justify-content: center; padding: 2rem;`;
  
  const containerStyles = embed
    ? `background: transparent; border-radius: 0; box-shadow: none; max-width: 100%; width: 100%; padding: 0;`
    : `background: white; border-radius: 16px; box-shadow: 0 4px 24px rgba(0,0,0,0.1); max-width: 600px; width: 100%; padding: 2.5rem;`;

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(form.page_title || form.name)}</title>
  <meta name="description" content="${escapeHtml(form.meta_description || form.subheader_text || form.header_text || `Preencha o formulário: ${form.name}`)}">
  <meta property="og:type" content="website">
  <meta property="og:site_name" content="${escapeHtml(form.name)}">
  <meta property="og:title" content="${escapeHtml(form.page_title || form.name)}">
  <meta property="og:description" content="${escapeHtml(form.meta_description || form.subheader_text || form.header_text || `Preencha o formulário: ${form.name}`)}">
  <meta property="og:url" content="${originUrl}/f/${form.slug}">
  <meta property="og:image" content="${escapeHtml(form.og_image_url || form.logo_url || 'https://storage.googleapis.com/gpt-engineer-file-uploads/r10144pT7xNLtO5e8KhIlmmX7Vf2/social-images/social-1766894338950-wide.png')}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${escapeHtml(form.page_title || form.name)}">
  <meta name="twitter:description" content="${escapeHtml(form.meta_description || form.subheader_text || form.header_text || `Preencha o formulário: ${form.name}`)}">
  <meta name="twitter:image" content="${escapeHtml(form.og_image_url || form.logo_url || 'https://storage.googleapis.com/gpt-engineer-file-uploads/r10144pT7xNLtO5e8KhIlmmX7Vf2/social-images/social-1766894338950-wide.png')}">
  <link rel="canonical" href="${originUrl}/f/${form.slug}">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(sanitizeFontFamily(form.font_family))}:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-color: ${sanitizeColor(form.primary_color, '#3b82f6')};
      --bg-color: ${sanitizeColor(form.background_color, '#ffffff')};
      --font-family: '${sanitizeFontFamily(form.font_family)}', sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body { ${bodyStyles} }
    .form-container { ${containerStyles} }
    .logo { max-height: 60px; margin-bottom: 1.5rem; }
    h1 { font-size: 1.75rem; font-weight: 600; color: #111; margin-bottom: 0.5rem; }
    .subheader { color: #666; margin-bottom: 2rem; font-size: 1rem; }
    .field { margin-bottom: 1.5rem; }
    label { display: block; font-weight: 500; color: #333; margin-bottom: 0.5rem; font-size: 0.9rem; }
    .required { color: #ef4444; }
    input, textarea, select {
      width: 100%;
      padding: 0.75rem 1rem;
      border: 1px solid #d1d5db;
      border-radius: 8px;
      font-size: 1rem;
      font-family: inherit;
      transition: border-color 0.2s, box-shadow 0.2s;
    }
    input:focus, textarea:focus, select:focus {
      outline: none;
      border-color: var(--primary-color);
      box-shadow: 0 0 0 3px color-mix(in srgb, var(--primary-color) 20%, transparent);
    }
    textarea { min-height: 100px; resize: vertical; }
    .help-text { font-size: 0.8rem; color: #666; margin-top: 0.25rem; }
    .checkbox-group, .radio-group { display: flex; flex-direction: column; gap: 0.5rem; }
    .checkbox-item, .radio-item {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      cursor: pointer;
    }
    .checkbox-item input, .radio-item input { width: auto; }
    .submit-btn {
      width: 100%;
      padding: 1rem;
      background: var(--primary-color);
      color: white;
      border: none;
      border-radius: 8px;
      font-size: 1rem;
      font-weight: 600;
      cursor: pointer;
      transition: opacity 0.2s;
    }
    .submit-btn:hover { opacity: 0.9; }
    .submit-btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .success-message {
      text-align: center;
      padding: 2rem;
    }
    .success-message h2 { color: #10b981; margin-bottom: 1rem; }
    .heading { font-size: 1.25rem; font-weight: 600; color: #111; margin: 1.5rem 0 1rem; }
    .paragraph { color: #666; margin-bottom: 1rem; }
    .divider { border-top: 1px solid #e5e7eb; margin: 1.5rem 0; }
    .name-group { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .address-group { display: flex; flex-direction: column; gap: 0.75rem; }
    .address-row { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 0.75rem; }
    .address-row-2 { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; }
    .rating { display: flex; gap: 0.25rem; }
    .rating button { background: none; border: none; cursor: pointer; font-size: 1.5rem; color: #d1d5db; transition: color 0.2s; }
    .rating button.active, .rating button:hover { color: #f59e0b; }
    .error-text { color: #ef4444; font-size: 0.8rem; margin-top: 0.25rem; }
    .phone-input-group { display: flex; gap: 0.5rem; }
    .country-code-select { 
      width: 110px; 
      flex-shrink: 0;
      padding: 0.75rem 0.5rem;
      font-size: 0.95rem;
    }
    .phone-input { flex: 1; }
    .district-search-container { position: relative; }
    .district-search-input { margin-bottom: 0.5rem; }
    .district-select { width: 100%; }
    /* Scheduling calendar styles */
    .scheduling-container { border: 1px solid #e5e7eb; border-radius: 12px; overflow: hidden; }
    .calendar-header { display: flex; align-items: center; justify-content: space-between; padding: 0.75rem 1rem; background: #f9fafb; border-bottom: 1px solid #e5e7eb; }
    .calendar-header button { background: none; border: 1px solid #d1d5db; border-radius: 6px; padding: 0.25rem 0.5rem; cursor: pointer; font-size: 0.85rem; }
    .calendar-header button:hover { background: #f3f4f6; }
    .calendar-header span { font-weight: 600; font-size: 0.95rem; }
    .calendar-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 2px; padding: 0.5rem; }
    .calendar-grid .day-name { text-align: center; font-size: 0.7rem; font-weight: 600; color: #9ca3af; padding: 0.25rem; }
    .calendar-grid .day { text-align: center; padding: 0.5rem 0.25rem; border-radius: 8px; cursor: pointer; font-size: 0.85rem; transition: all 0.15s; }
    .calendar-grid .day:hover:not(.disabled):not(.empty) { background: color-mix(in srgb, var(--primary-color) 15%, transparent); }
    .calendar-grid .day.selected { background: var(--primary-color); color: white; font-weight: 600; }
    .calendar-grid .day.disabled { color: #d1d5db; cursor: not-allowed; }
    .calendar-grid .day.empty { cursor: default; }
    .calendar-grid .day.today { font-weight: 700; color: var(--primary-color); }
    .slots-container { padding: 1rem; border-top: 1px solid #e5e7eb; }
    .slots-container h4 { font-size: 0.85rem; font-weight: 600; margin-bottom: 0.75rem; color: #374151; }
    .slots-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(80px, 1fr)); gap: 0.5rem; }
    .slot-btn { padding: 0.5rem; border: 1px solid #d1d5db; border-radius: 8px; background: white; cursor: pointer; font-size: 0.85rem; text-align: center; transition: all 0.15s; }
    .slot-btn:hover { border-color: var(--primary-color); background: color-mix(in srgb, var(--primary-color) 10%, transparent); }
    .slot-btn.selected { background: var(--primary-color); color: white; border-color: var(--primary-color); }
    .slots-loading { text-align: center; color: #9ca3af; font-size: 0.85rem; padding: 1rem; }
    .slots-empty { text-align: center; color: #9ca3af; font-size: 0.85rem; padding: 1rem; }
  </style>
</head>
<body>
  <div class="form-container">
    ${!embed && form.logo_url ? `<img src="${escapeHtml(form.logo_url)}" alt="Logo" class="logo">` : ''}
    ${!embed && form.header_text ? `<h1>${escapeHtml(form.header_text)}</h1>` : ''}
    ${!embed && form.subheader_text ? `<p class="subheader">${escapeHtml(form.subheader_text)}</p>` : ''}
    
    <form id="public-form">
      <input type="hidden" name="form_id" value="${form.id}">
      ${staticParamsHTML}
      ${fieldsHTML}
      <button type="submit" class="submit-btn">${escapeHtml(form.submit_button_text || 'Enviar')}</button>
    </form>

    <div id="success-message" class="success-message" style="display: none;">
      <h2>✓</h2>
      <p>${escapeHtml(form.success_message || 'Obrigado! Sua resposta foi enviada.')}</p>
    </div>
  </div>

  <script>
    const form = document.getElementById('public-form');
    const successMessage = document.getElementById('success-message');
    const submitBtn = form.querySelector('.submit-btn');
    const redirectUrl = ${form.redirect_url ? `"${escapeHtml(form.redirect_url)}"` : 'null'};

    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      submitBtn.disabled = true;
      submitBtn.textContent = 'Enviando...';

      const formData = new FormData(form);
      const data = {};
      
      for (const [key, value] of formData.entries()) {
        if (key.endsWith('[]')) {
          const cleanKey = key.slice(0, -2);
          if (!data[cleanKey]) data[cleanKey] = [];
          data[cleanKey].push(value);
        } else {
          data[key] = value;
        }
      }

      try {
        const response = await fetch('${Deno.env.get('SUPABASE_URL')}/functions/v1/submit-form', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(data)
        });

        if (!response.ok) {
          throw new Error('Erro ao enviar formulário');
        }

        form.style.display = 'none';
        
        if (redirectUrl) {
          try {
            window.top.location.href = redirectUrl;
          } catch (e) {
            window.location.href = redirectUrl;
          }
        } else {
          successMessage.style.display = 'block';
        }
      } catch (error) {
        console.error('Error:', error);
        alert('Erro ao enviar formulário. Tente novamente.');
        submitBtn.disabled = false;
        submitBtn.textContent = '${escapeHtml(form.submit_button_text || 'Enviar')}';
      }
    });

    // Rating functionality
    document.querySelectorAll('.rating').forEach(rating => {
      const buttons = rating.querySelectorAll('button');
      const input = rating.querySelector('input');
      
      buttons.forEach((btn, index) => {
        btn.addEventListener('click', () => {
          input.value = index + 1;
          buttons.forEach((b, i) => {
            b.classList.toggle('active', i <= index);
          });
        });
      });
    });

    // Phone formatting functionality
    function formatBrazilianPhone(value) {
      const digits = value.replace(/\\D/g, '').slice(0, 11);
      if (digits.length <= 2) return digits.length ? '(' + digits : '';
      if (digits.length <= 6) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2);
      if (digits.length <= 10) return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 6) + '-' + digits.slice(6);
      return '(' + digits.slice(0, 2) + ') ' + digits.slice(2, 7) + '-' + digits.slice(7);
    }

    function formatGenericPhone(value) {
      const digits = value.replace(/\\D/g, '').slice(0, 15);
      // Format in groups of 4
      let formatted = '';
      for (let i = 0; i < digits.length; i += 4) {
        if (i > 0) formatted += ' ';
        formatted += digits.slice(i, i + 4);
      }
      return formatted;
    }

    document.querySelectorAll('.phone-input').forEach(input => {
      const fieldId = input.dataset.fieldId;
      const countrySelect = document.querySelector('[name="' + fieldId + '_country_code"]');
      
      input.addEventListener('input', (e) => {
        const countryCode = countrySelect ? countrySelect.value : '55';
        if (countryCode === '55') {
          e.target.value = formatBrazilianPhone(e.target.value);
        } else {
          e.target.value = formatGenericPhone(e.target.value);
        }
      });

      if (countrySelect) {
        countrySelect.addEventListener('change', () => {
          input.value = '';
          if (countrySelect.value === '55') {
            input.placeholder = '(XX) XXXXX-XXXX';
          } else {
            input.placeholder = 'Digite o número';
          }
        });
      }
    });

    // Build value-to-label mapping for fields with options (radio, select, checkbox)
    var fieldOptionLabels = ${JSON.stringify(
      fields.reduce((acc: Record<string, Record<string, string>>, f: any) => {
        if (f.options && Array.isArray(f.options) && f.options.length > 0) {
          acc[f.id] = {};
          f.options.forEach((opt: any) => {
            acc[f.id][opt.value] = opt.label;
          });
        }
        return acc;
      }, {} as Record<string, Record<string, string>>)
    )};

    // Conditional logic: show/hide fields based on other fields' values
    // Supports multiple conditions with AND/OR logic
    function getFieldValue(fieldId) {
      var labelMap = fieldOptionLabels[fieldId] || {};
      function getRefLabel(rawValue) { return labelMap[rawValue] || rawValue; }
      var radio = document.querySelector('input[name="' + fieldId + '"]:checked');
      if (radio) return getRefLabel(radio.value);
      var input = document.querySelector('[name="' + fieldId + '"]');
      if (input && input.tagName === 'SELECT') {
        var selected = input.options[input.selectedIndex];
        return selected ? getRefLabel(selected.value) : '';
      }
      if (input) return input.value;
      var checked = document.querySelectorAll('[name="' + fieldId + '[]"]:checked');
      if (checked.length > 0) {
        var vals = [];
        checked.forEach(function(c) { vals.push(getRefLabel(c.value)); });
        return vals.join(',');
      }
      return '';
    }

    function evaluateCondition(cond) {
      var val = getFieldValue(cond.field_id);
      switch (cond.operator) {
        case 'equals': return val === (cond.value || '');
        case 'not_equals': return val !== (cond.value || '');
        case 'contains': return val.indexOf(cond.value || '') !== -1;
        case 'is_empty': return val === '';
        case 'is_not_empty': return val !== '';
        default: return val === (cond.value || '');
      }
    }

    function toggleField(el, show) {
      el.style.display = show ? '' : 'none';
      var inputs = el.querySelectorAll('input, select, textarea');
      inputs.forEach(function(inp) {
        if (!show) {
          if (inp.hasAttribute('required')) inp.dataset.wasRequired = 'true';
          inp.removeAttribute('required');
        } else if (inp.dataset.wasRequired === 'true') {
          inp.setAttribute('required', '');
        }
      });
    }

    // New multi-condition format
    document.querySelectorAll('[data-conditional-rules]').forEach(function(el) {
      var conditions = [];
      try { conditions = JSON.parse(el.getAttribute('data-conditional-rules')); } catch(e) {}
      var logicOp = el.getAttribute('data-conditional-logic') || 'and';
      var refFieldIds = {};
      conditions.forEach(function(c) { if (c.field_id) refFieldIds[c.field_id] = true; });

      function evaluate() {
        var show = false;
        if (conditions.length === 0) { show = true; }
        else if (logicOp === 'or') {
          show = conditions.some(function(c) { return evaluateCondition(c); });
        } else {
          show = conditions.every(function(c) { return evaluateCondition(c); });
        }
        toggleField(el, show);
      }

      Object.keys(refFieldIds).forEach(function(fieldId) {
        var refInputs = document.querySelectorAll('[name="' + fieldId + '"], [name="' + fieldId + '[]"]');
        refInputs.forEach(function(inp) {
          inp.addEventListener('change', evaluate);
          inp.addEventListener('input', evaluate);
        });
      });
      evaluate();
    });

    // Backward compat: old single-condition data attributes
    document.querySelectorAll('[data-conditional-field]').forEach(function(el) {
      if (el.hasAttribute('data-conditional-rules')) return;
      var refFieldId = el.getAttribute('data-conditional-field');
      var operator = el.getAttribute('data-conditional-operator');
      var expectedValue = el.getAttribute('data-conditional-value');

      function evaluate() {
        var show = evaluateCondition({ field_id: refFieldId, operator: operator, value: expectedValue });
        toggleField(el, show);
      }

      var refInputs = document.querySelectorAll('[name="' + refFieldId + '"], [name="' + refFieldId + '[]"]');
      refInputs.forEach(function(inp) {
        inp.addEventListener('change', evaluate);
        inp.addEventListener('input', evaluate);
      });
      evaluate();
    });
  </script>
</body>
</html>`;
}

function generateFieldHTML(field: any): string {
  const required = field.required ? 'required' : '';
  const requiredStar = field.required ? '<span class="required">*</span>' : '';
  const helpText = field.help_text ? `<p class="help-text">${escapeHtml(field.help_text)}</p>` : '';

  // Conditional logic data attributes - supports multiple conditions
  const cl = field.conditional_logic;
  let conditionalAttrs = '';
  if (cl?.enabled) {
    // Build conditions array (backward compatible with single-condition format)
    const conditions = Array.isArray(cl.conditions) && cl.conditions.length > 0
      ? cl.conditions
      : cl.field_id
        ? [{ field_id: cl.field_id, operator: cl.operator || 'equals', value: cl.value || '' }]
        : [];
    
    if (conditions.length > 0) {
      const logicOp = cl.logic_operator || 'and';
      const conditionsJson = JSON.stringify(conditions).replace(/"/g, '&quot;');
      conditionalAttrs = ` data-conditional-rules="${conditionsJson}" data-conditional-logic="${logicOp}" style="display:none;"`;
    }
  }

  switch (field.field_type) {
    case 'short_text':
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="text" name="${field.id}" placeholder="${escapeHtml(field.placeholder || '')}" ${required}>
        ${helpText}
      </div>`;

    case 'long_text':
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <textarea name="${field.id}" placeholder="${escapeHtml(field.placeholder || '')}" ${required}></textarea>
        ${helpText}
      </div>`;

    case 'email':
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="email" name="${field.id}" placeholder="${escapeHtml(field.placeholder || '')}" ${required}>
        ${helpText}
      </div>`;

    case 'phone':
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <div class="phone-input-group">
          <select name="${field.id}_country_code" class="country-code-select">
            ${generateCountryOptionsHTML()}
          </select>
          <input type="tel" name="${field.id}" class="phone-input" placeholder="${escapeHtml(field.placeholder || '(XX) XXXXX-XXXX')}" ${required} data-field-id="${field.id}">
        </div>
        ${helpText}
      </div>`;

    case 'number':
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="number" name="${field.id}" placeholder="${escapeHtml(field.placeholder || '')}" ${required}>
        ${helpText}
      </div>`;

    case 'url':
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="url" name="${field.id}" placeholder="${escapeHtml(field.placeholder || 'https://')}" ${required}>
        ${helpText}
      </div>`;

    case 'date':
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="date" name="${field.id}" ${required}>
        ${helpText}
      </div>`;

    case 'time':
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="time" name="${field.id}" ${required}>
        ${helpText}
      </div>`;

    case 'datetime':
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="datetime-local" name="${field.id}" ${required}>
        ${helpText}
      </div>`;

    case 'select':
      const selectOptions = (field.options || [])
        .map((opt: any) => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`)
        .join('');
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <select name="${field.id}" ${required}>
          <option value="">${escapeHtml(field.placeholder || 'Selecione...')}</option>
          ${selectOptions}
        </select>
        ${helpText}
      </div>`;

    case 'multi_select':
    case 'checkbox':
      const checkboxes = (field.options || [])
        .map((opt: any) => `
          <label class="checkbox-item">
            <input type="checkbox" name="${field.id}[]" value="${escapeHtml(opt.value)}">
            <span>${escapeHtml(opt.label)}</span>
          </label>
        `).join('');
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <div class="checkbox-group">${checkboxes}</div>
        ${helpText}
      </div>`;

    case 'radio':
      const radios = (field.options || [])
        .map((opt: any) => `
          <label class="radio-item">
            <input type="radio" name="${field.id}" value="${escapeHtml(opt.value)}" ${required}>
            <span>${escapeHtml(opt.label)}</span>
          </label>
        `).join('');
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <div class="radio-group">${radios}</div>
        ${helpText}
      </div>`;

    case 'rating':
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <div class="rating">
          <input type="hidden" name="${field.id}" value="">
          <button type="button">★</button>
          <button type="button">★</button>
          <button type="button">★</button>
          <button type="button">★</button>
          <button type="button">★</button>
        </div>
        ${helpText}
      </div>`;

    case 'name':
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <div class="name-group">
          <input type="text" name="${field.id}_first" placeholder="Nome" ${required}>
          <input type="text" name="${field.id}_last" placeholder="Sobrenome" ${required}>
        </div>
        ${helpText}
      </div>`;

    case 'address':
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <div class="address-group">
          <input type="text" name="${field.id}_street" placeholder="Rua" ${required}>
          <div class="address-row">
            <input type="text" name="${field.id}_number" placeholder="Número" ${required}>
            <input type="text" name="${field.id}_complement" placeholder="Complemento">
            <input type="text" name="${field.id}_zip" placeholder="CEP" ${required}>
          </div>
          <div class="address-row-2">
            <input type="text" name="${field.id}_city" placeholder="Cidade" ${required}>
            <input type="text" name="${field.id}_state" placeholder="Estado" ${required}>
          </div>
        </div>
        ${helpText}
      </div>`;

    case 'hidden':
      return `<input type="hidden" name="${field.id}" value="${escapeHtml(field.settings?.default_value || '')}">`;

    case 'heading':
      return `<h2 class="heading">${escapeHtml(field.label)}</h2>`;

    case 'paragraph':
      return `<p class="paragraph">${escapeHtml(field.help_text || field.label)}</p>`;

    case 'divider':
      return `<hr class="divider">`;

    case 'district': {
      const districtUfs: string[] = field.settings?.ufs || [];
      const districtUfsJson = JSON.stringify(districtUfs);
      const districtPlaceholder = escapeHtml(field.placeholder || 'Selecione o distrito...');
      const districtScript = '(function(){' +
        'var ufs=' + districtUfsJson + ';' +
        'var sel=document.getElementById("district-select-' + field.id + '");' +
        'if(ufs.length===0)return;' +
        'sel.innerHTML="<option value=\\"\\">Carregando...</option>";' +
        'Promise.all(ufs.map(function(uf){' +
        'return fetch("https://servicodados.ibge.gov.br/api/v1/localidades/estados/"+uf+"/distritos?orderBy=nome").then(function(r){return r.json()});' +
        '})).then(function(res){' +
        'var n=[];res.forEach(function(a){a.forEach(function(d){n.push(d.nome)})});' +
        'var u=[];n.forEach(function(x){if(u.indexOf(x)===-1)u.push(x)});' +
        'u.sort();' +
        'sel.innerHTML="<option value=\\"\\">'+districtPlaceholder+'</option>";' +
        'u.forEach(function(nome){var o=document.createElement("option");o.value=nome;o.textContent=nome;sel.appendChild(o)});' +
        '}).catch(function(){sel.innerHTML="<option value=\\"\\">Erro ao carregar</option>"});' +
        '})();';

      return '<div class="field"' + conditionalAttrs + '>'
        + '<label>' + escapeHtml(field.label) + requiredStar + '</label>'
        + '<select name="' + field.id + '" id="district-select-' + field.id + '" ' + required + '>'
        + '<option value="">' + districtPlaceholder + '</option>'
        + '</select>'
        + helpText
        + '<script>' + districtScript + '</script>'
        + '</div>';
    }

    case 'scheduling': {
      const scheduleConfig = field.settings?.schedule || {};
      const weeklyHours = scheduleConfig.weekly_hours || {};
      const blockedDates = JSON.stringify(scheduleConfig.blocked_dates || []);
      const maxAdvanceDays = scheduleConfig.max_advance_days || 30;
      const enabledDays = JSON.stringify(Object.entries(weeklyHours).filter(([,v]: any) => v.enabled).map(([k]: any) => Number(k)));
      // Note: scheduling field uses conditionalAttrs on its wrapper div below
      
      const calendarScript = `(function(){
        var fieldId="${field.id}";
        var formId="${field.form_id}";
        var blockedDates=${blockedDates};
        var enabledDays=${enabledDays};
        var maxAdvanceDays=${maxAdvanceDays};
        var container=document.getElementById("sched-"+fieldId);
        var hiddenInput=document.getElementById("sched-input-"+fieldId);
        var today=new Date();today.setHours(0,0,0,0);
        var maxDate=new Date(today);maxDate.setDate(maxDate.getDate()+maxAdvanceDays);
        var currentMonth=today.getMonth();
        var currentYear=today.getFullYear();
        var selectedDate=null;
        var selectedSlot=null;

        function pad(n){return n<10?'0'+n:n;}
        function dateStr(d){return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());}
        var monthNames=['Janeiro','Fevereiro','Março','Abril','Maio','Junho','Julho','Agosto','Setembro','Outubro','Novembro','Dezembro'];

        function render(){
          var html='<div class="calendar-header">';
          html+='<button type="button" onclick="schedNav(\\'' + fieldId + '\\',-1)">◀</button>';
          html+='<span>'+monthNames[currentMonth]+' '+currentYear+'</span>';
          html+='<button type="button" onclick="schedNav(\\'' + fieldId + '\\',1)">▶</button>';
          html+='</div>';
          html+='<div class="calendar-grid">';
          var dayNames=['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'];
          dayNames.forEach(function(d){html+='<div class="day-name">'+d+'</div>';});
          var first=new Date(currentYear,currentMonth,1);
          var startDay=first.getDay();
          var daysInMonth=new Date(currentYear,currentMonth+1,0).getDate();
          for(var i=0;i<startDay;i++)html+='<div class="day empty"></div>';
          for(var d=1;d<=daysInMonth;d++){
            var dt=new Date(currentYear,currentMonth,d);
            var ds=dateStr(dt);
            var dow=dt.getDay();
            var disabled=!enabledDays.includes(dow)||dt<today||dt>maxDate||blockedDates.includes(ds);
            var isToday=dt.getTime()===today.getTime();
            var isSelected=selectedDate===ds;
            var cls='day'+(disabled?' disabled':'')+(isToday?' today':'')+(isSelected?' selected':'');
            html+='<div class="'+cls+'" '+(disabled?'':'onclick="schedSelect(\\'' + fieldId + '\\',\\''+ds+'\\','+dow+')"')+'>'+d+'</div>';
          }
          html+='</div>';
          html+='<div id="sched-slots-'+fieldId+'" class="slots-container" style="display:none;"></div>';
          container.innerHTML=html;
          if(selectedDate)loadSlots(selectedDate);
        }

        window['schedNav_'+fieldId]={currentMonth:currentMonth,currentYear:currentYear,render:render};
        window.schedNav=function(fid,dir){
          var s=window['schedNav_'+fid];
          s.currentMonth+=dir;
          if(s.currentMonth>11){s.currentMonth=0;s.currentYear++;}
          if(s.currentMonth<0){s.currentMonth=11;s.currentYear--;}
          currentMonth=s.currentMonth;currentYear=s.currentYear;
          render();
        };
        window.schedSelect=function(fid,ds,dow){
          selectedDate=ds;selectedSlot=null;
          hiddenInput.value='';
          render();
        };
        window.schedSlotPick=function(fid,time){
          selectedSlot=time;
          hiddenInput.value=selectedDate+' '+time;
          var btns=document.querySelectorAll('#sched-slots-'+fid+' .slot-btn');
          btns.forEach(function(b){b.classList.toggle('selected',b.textContent===time);});
        };

        function loadSlots(ds){
          var slotsDiv=document.getElementById('sched-slots-'+fieldId);
          slotsDiv.style.display='block';
          slotsDiv.innerHTML='<div class="slots-loading">Carregando horários...</div>';
          fetch('${Deno.env.get('SUPABASE_URL')}/functions/v1/check-availability?form_id='+formId+'&field_id='+fieldId+'&date='+ds)
            .then(function(r){return r.json();})
            .then(function(data){
              if(!data.slots||data.slots.length===0){
                slotsDiv.innerHTML='<div class="slots-empty">Nenhum horário disponível nesta data</div>';
                return;
              }
              var html='<h4>Horários disponíveis</h4><div class="slots-grid">';
              data.slots.forEach(function(slot){
                var sel=selectedSlot===slot?' selected':'';
                html+='<button type="button" class="slot-btn'+sel+'" onclick="schedSlotPick(\\'' + fieldId + '\\',\\''+slot+'\\')">'+slot+'</button>';
              });
              html+='</div>';
              slotsDiv.innerHTML=html;
            })
            .catch(function(){
              slotsDiv.innerHTML='<div class="slots-empty">Erro ao carregar horários</div>';
            });
        }

        render();
      })();`;

      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="hidden" id="sched-input-${field.id}" name="${field.id}" ${required}>
        <div id="sched-${field.id}" class="scheduling-container"></div>
        ${helpText}
        <script>${calendarScript}</script>
      </div>`;
    }

    default:
      return `<div class="field"${conditionalAttrs}>
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="text" name="${field.id}" placeholder="${escapeHtml(field.placeholder || '')}" ${required}>
        ${helpText}
      </div>`;
  }
}

function escapeHtml(text: string): string {
  if (!text) return '';
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function sanitizeColor(color: string | null | undefined, fallback: string): string {
  if (!color || typeof color !== 'string') return fallback;
  const trimmed = color.trim();
  // Allow #RGB, #RRGGBB, #RRGGBBAA hex colors only
  if (/^#([0-9A-Fa-f]{3}|[0-9A-Fa-f]{6}|[0-9A-Fa-f]{8})$/.test(trimmed)) return trimmed;
  return fallback;
}

function sanitizeFontFamily(font: string | null | undefined): string {
  if (!font || typeof font !== 'string') return 'Inter';
  const safe = font.replace(/[^a-zA-Z0-9\s-]/g, '').trim();
  return safe.length > 0 ? safe.slice(0, 64) : 'Inter';
}
