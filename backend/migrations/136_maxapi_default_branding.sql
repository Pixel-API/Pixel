-- Switch the deployed default site branding from Sub2API to MaxAPI.
-- Preserve any operator-customized branding by only updating the old default.

UPDATE settings
SET value = 'MaxAPI',
    updated_at = NOW()
WHERE key = 'site_name'
  AND (value IS NULL OR btrim(value) = '' OR value = 'Sub2API');

INSERT INTO settings (key, value)
VALUES ('site_name', 'MaxAPI')
ON CONFLICT (key) DO NOTHING;
