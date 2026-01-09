-- Add column to store extracted text content from documents (PDFs)
ALTER TABLE inbox_messages 
ADD COLUMN IF NOT EXISTS extracted_content TEXT;

COMMENT ON COLUMN inbox_messages.extracted_content IS 
'Extracted text content from documents (PDFs) using AI';