import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const url = new URL(req.url);
    const slug = url.searchParams.get('slug');
    const staticParamsJson = url.searchParams.get('static_params');

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
        headers: { ...corsHeaders, 'Content-Type': 'text/html' } 
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

    // Generate form HTML with static params
    const html = generateFormHTML(form, formFields, staticParams);

    return new Response(html, {
      headers: { ...corsHeaders, 'Content-Type': 'text/html' },
    });

  } catch (error) {
    console.error('Error in public-form:', error);
    return new Response(
      JSON.stringify({ error: 'Erro interno do servidor' }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    );
  }
});

function generateFormHTML(form: any, fields: any[], staticParams: { key: string; value: string }[]): string {
  const fieldsHTML = fields
    .filter(f => !['heading', 'paragraph', 'divider'].includes(f.field_type) || f.field_type === 'heading' || f.field_type === 'paragraph' || f.field_type === 'divider')
    .map(field => generateFieldHTML(field))
    .join('\n');

  // Generate hidden fields for static params
  const staticParamsHTML = staticParams
    .map(p => `<input type="hidden" name="_static_${escapeHtml(p.key)}" value="${escapeHtml(p.value)}">`)
    .join('\n');

  return `<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${escapeHtml(form.page_title || form.name)}</title>
  ${form.meta_description ? `<meta name="description" content="${escapeHtml(form.meta_description)}">` : ''}
  ${form.og_image_url ? `
  <meta property="og:image" content="${escapeHtml(form.og_image_url)}">
  <meta property="og:title" content="${escapeHtml(form.page_title || form.name)}">
  ` : ''}
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=${encodeURIComponent(form.font_family || 'Inter')}:wght@400;500;600&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary-color: ${form.primary_color || '#3b82f6'};
      --bg-color: ${form.background_color || '#ffffff'};
      --font-family: '${form.font_family || 'Inter'}', sans-serif;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: var(--font-family);
      background: var(--bg-color);
      min-height: 100vh;
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 2rem;
    }
    .form-container {
      background: white;
      border-radius: 16px;
      box-shadow: 0 4px 24px rgba(0,0,0,0.1);
      max-width: 600px;
      width: 100%;
      padding: 2.5rem;
    }
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
  </style>
</head>
<body>
  <div class="form-container">
    ${form.logo_url ? `<img src="${escapeHtml(form.logo_url)}" alt="Logo" class="logo">` : ''}
    ${form.header_text ? `<h1>${escapeHtml(form.header_text)}</h1>` : ''}
    ${form.subheader_text ? `<p class="subheader">${escapeHtml(form.subheader_text)}</p>` : ''}
    
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
          window.location.href = redirectUrl;
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
  </script>
</body>
</html>`;
}

function generateFieldHTML(field: any): string {
  const required = field.required ? 'required' : '';
  const requiredStar = field.required ? '<span class="required">*</span>' : '';
  const helpText = field.help_text ? `<p class="help-text">${escapeHtml(field.help_text)}</p>` : '';

  switch (field.field_type) {
    case 'short_text':
      return `<div class="field">
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="text" name="${field.id}" placeholder="${escapeHtml(field.placeholder || '')}" ${required}>
        ${helpText}
      </div>`;

    case 'long_text':
      return `<div class="field">
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <textarea name="${field.id}" placeholder="${escapeHtml(field.placeholder || '')}" ${required}></textarea>
        ${helpText}
      </div>`;

    case 'email':
      return `<div class="field">
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="email" name="${field.id}" placeholder="${escapeHtml(field.placeholder || '')}" ${required}>
        ${helpText}
      </div>`;

    case 'phone':
      return `<div class="field">
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="tel" name="${field.id}" placeholder="${escapeHtml(field.placeholder || '')}" ${required}>
        ${helpText}
      </div>`;

    case 'number':
      return `<div class="field">
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="number" name="${field.id}" placeholder="${escapeHtml(field.placeholder || '')}" ${required}>
        ${helpText}
      </div>`;

    case 'url':
      return `<div class="field">
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="url" name="${field.id}" placeholder="${escapeHtml(field.placeholder || 'https://')}" ${required}>
        ${helpText}
      </div>`;

    case 'date':
      return `<div class="field">
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="date" name="${field.id}" ${required}>
        ${helpText}
      </div>`;

    case 'time':
      return `<div class="field">
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="time" name="${field.id}" ${required}>
        ${helpText}
      </div>`;

    case 'datetime':
      return `<div class="field">
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <input type="datetime-local" name="${field.id}" ${required}>
        ${helpText}
      </div>`;

    case 'select':
      const selectOptions = (field.options || [])
        .map((opt: any) => `<option value="${escapeHtml(opt.value)}">${escapeHtml(opt.label)}</option>`)
        .join('');
      return `<div class="field">
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
      return `<div class="field">
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
      return `<div class="field">
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <div class="radio-group">${radios}</div>
        ${helpText}
      </div>`;

    case 'rating':
      return `<div class="field">
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
      return `<div class="field">
        <label>${escapeHtml(field.label)}${requiredStar}</label>
        <div class="name-group">
          <input type="text" name="${field.id}_first" placeholder="Nome" ${required}>
          <input type="text" name="${field.id}_last" placeholder="Sobrenome" ${required}>
        </div>
        ${helpText}
      </div>`;

    case 'address':
      return `<div class="field">
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

    default:
      return `<div class="field">
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
