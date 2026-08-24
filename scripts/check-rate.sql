SELECT key_id, bucket_start, request_count FROM public.api_rate_limit ORDER BY bucket_start DESC LIMIT 5;
