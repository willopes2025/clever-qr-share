import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { toast } from "sonner";

export interface StaticUrlParam {
  key: string;
  value: string;
}

export interface Form {
  id: string;
  user_id: string;
  name: string;
  description: string | null;
  slug: string;
  status: 'draft' | 'published' | 'archived';
  page_title: string | null;
  header_text: string | null;
  subheader_text: string | null;
  logo_url: string | null;
  background_color: string;
  primary_color: string;
  font_family: string;
  success_message: string;
  redirect_url: string | null;
  submit_button_text: string;
  meta_description: string | null;
  og_image_url: string | null;
  settings: Record<string, any>;
  url_static_params?: StaticUrlParam[] | any;
  target_funnel_id: string | null;
  target_stage_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormField {
  id: string;
  form_id: string;
  user_id: string;
  field_type: string;
  label: string;
  placeholder: string | null;
  help_text: string | null;
  required: boolean;
  options: Array<{ value: string; label: string }> | null;
  validation: Record<string, any> | null;
  mapping_type: 'contact_field' | 'custom_field' | 'new_custom_field' | 'lead_field' | 'new_lead_field' | null;
  mapping_target: string | null;
  create_custom_field_on_submit: boolean;
  conditional_logic: Record<string, any> | null;
  position: number;
  settings: Record<string, any>;
  created_at: string;
}

export interface FormSubmission {
  id: string;
  form_id: string;
  contact_id: string | null;
  user_id: string;
  data: Record<string, any>;
  metadata: Record<string, any> | null;
  created_at: string;
}

export interface FormWebhook {
  id: string;
  form_id: string;
  user_id: string;
  name: string;
  target_url: string;
  events: string[];
  headers: Record<string, string> | null;
  is_active: boolean;
  created_at: string;
}

export type CreateFormData = Omit<Form, 'id' | 'user_id' | 'created_at' | 'updated_at'>;
export type UpdateFormData = Partial<CreateFormData>;
export type CreateFieldData = Omit<FormField, 'id' | 'user_id' | 'created_at'>;
export type UpdateFieldData = Partial<Omit<CreateFieldData, 'form_id'>>;

export const useForms = () => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: forms, isLoading, error } = useQuery({
    queryKey: ['forms', user?.id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as Form[];
    },
    enabled: !!user,
  });

  const createForm = useMutation({
    mutationFn: async (formData: CreateFormData) => {
      const { data, error } = await supabase
        .from('forms')
        .insert({
          ...formData,
          user_id: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as Form;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success("Formulário criado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar formulário: " + error.message);
    },
  });

  const updateForm = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateFormData & { id: string }) => {
      const { data, error } = await supabase
        .from('forms')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as Form;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success("Formulário atualizado!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar formulário: " + error.message);
    },
  });

  const deleteForm = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('forms')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success("Formulário excluído!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir formulário: " + error.message);
    },
  });

  const duplicateForm = useMutation({
    mutationFn: async (formId: string) => {
      // Get the original form
      const { data: originalForm, error: fetchError } = await supabase
        .from('forms')
        .select('*')
        .eq('id', formId)
        .single();

      if (fetchError) throw fetchError;

      // Get the original fields
      const { data: originalFields, error: fieldsError } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', formId)
        .order('position');

      if (fieldsError) throw fieldsError;

      // Create new form with modified name and slug
      const newSlug = `${originalForm.slug}-copia-${Date.now()}`;
      const { data: newForm, error: createError } = await supabase
        .from('forms')
        .insert({
          ...originalForm,
          id: undefined,
          name: `${originalForm.name} (Cópia)`,
          slug: newSlug,
          status: 'draft',
          created_at: undefined,
          updated_at: undefined,
        })
        .select()
        .single();

      if (createError) throw createError;

      // Duplicate fields
      if (originalFields && originalFields.length > 0) {
        const newFields = originalFields.map(field => ({
          ...field,
          id: undefined,
          form_id: newForm.id,
          created_at: undefined,
        }));

        const { error: insertFieldsError } = await supabase
          .from('form_fields')
          .insert(newFields);

        if (insertFieldsError) throw insertFieldsError;
      }

      return newForm as Form;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['forms'] });
      toast.success("Formulário duplicado com sucesso!");
    },
    onError: (error: Error) => {
      toast.error("Erro ao duplicar formulário: " + error.message);
    },
  });

  return {
    forms,
    isLoading,
    error,
    createForm,
    updateForm,
    deleteForm,
    duplicateForm,
  };
};

export const useFormById = (formId: string | undefined) => {
  const { user } = useAuth();

  return useQuery({
    queryKey: ['form', formId],
    queryFn: async () => {
      if (!formId) throw new Error('Form ID is required');
      
      const { data, error } = await supabase
        .from('forms')
        .select('*')
        .eq('id', formId)
        .single();

      if (error) throw error;
      return data as Form;
    },
    enabled: !!user && !!formId,
  });
};

export const useFormFields = (formId: string | undefined) => {
  const { user } = useAuth();
  const queryClient = useQueryClient();

  const { data: fields, isLoading, error } = useQuery({
    queryKey: ['form-fields', formId],
    queryFn: async () => {
      if (!formId) throw new Error('Form ID is required');
      
      const { data, error } = await supabase
        .from('form_fields')
        .select('*')
        .eq('form_id', formId)
        .order('position');

      if (error) throw error;
      return data as FormField[];
    },
    enabled: !!user && !!formId,
  });

  const createField = useMutation({
    mutationFn: async (fieldData: CreateFieldData) => {
      const { data, error } = await supabase
        .from('form_fields')
        .insert({
          ...fieldData,
          user_id: user!.id,
        })
        .select()
        .single();

      if (error) throw error;
      return data as FormField;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-fields', formId] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao criar campo: " + error.message);
    },
  });

  const updateField = useMutation({
    mutationFn: async ({ id, ...updates }: UpdateFieldData & { id: string }) => {
      const { data, error } = await supabase
        .from('form_fields')
        .update(updates)
        .eq('id', id)
        .select()
        .single();

      if (error) throw error;
      return data as FormField;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-fields', formId] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao atualizar campo: " + error.message);
    },
  });

  const deleteField = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from('form_fields')
        .delete()
        .eq('id', id);

      if (error) throw error;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-fields', formId] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao excluir campo: " + error.message);
    },
  });

  const updateFieldsOrder = useMutation({
    mutationFn: async (orderedFields: { id: string; position: number }[]) => {
      const updates = orderedFields.map(field =>
        supabase
          .from('form_fields')
          .update({ position: field.position })
          .eq('id', field.id)
      );

      await Promise.all(updates);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['form-fields', formId] });
    },
    onError: (error: Error) => {
      toast.error("Erro ao reordenar campos: " + error.message);
    },
  });

  return {
    fields,
    isLoading,
    error,
    createField,
    updateField,
    deleteField,
    updateFieldsOrder,
  };
};

export const useFormSubmissions = (formId: string | undefined) => {
  const { user } = useAuth();

  const { data: submissions, isLoading, error } = useQuery({
    queryKey: ['form-submissions', formId],
    queryFn: async () => {
      if (!formId) throw new Error('Form ID is required');
      
      const { data, error } = await supabase
        .from('form_submissions')
        .select('*, contacts(name, phone, email)')
        .eq('form_id', formId)
        .order('created_at', { ascending: false });

      if (error) throw error;
      return data as (FormSubmission & { contacts: { name: string | null; phone: string; email: string | null } | null })[];
    },
    enabled: !!user && !!formId,
  });

  const queryClient = useQueryClient();

  const updateSubmission = async (submissionId: string, updatedData: Record<string, any>) => {
    const { error } = await supabase
      .from('form_submissions')
      .update({ data: updatedData as any })
      .eq('id', submissionId);
    if (error) throw error;
    queryClient.invalidateQueries({ queryKey: ['form-submissions', formId] });
  };

  return {
    submissions,
    isLoading,
    error,
    updateSubmission,
  };
};
