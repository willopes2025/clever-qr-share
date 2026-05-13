UPDATE campaign_messages SET status = 'queued', error_message = NULL WHERE campaign_id IN ('43b564a9-19cb-436d-bb4d-9a4b1339834e','b6be8635-3cb9-49ea-9e3a-4f318de0b917') AND status = 'failed' AND error_message = 'Unknown error';

UPDATE campaigns SET failed = 0, retry_at = NULL WHERE id IN ('43b564a9-19cb-436d-bb4d-9a4b1339834e','b6be8635-3cb9-49ea-9e3a-4f318de0b917');