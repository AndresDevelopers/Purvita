-- Script de prueba para insertar datos de threat intelligence
-- Esto te permitirá ver cómo se visualizan los datos en la página de seguridad

-- 1. Insertar una IP bloqueada automáticamente por threat intelligence
INSERT INTO blocked_ips (ip_address, reason, notes, expires_at, created_at)
VALUES (
  '192.168.1.100',
  'Malicious IP detected by multiple threat intelligence sources',
  '{"autoBlocked":true,"confidence":95,"sources":["virustotal","google_safe_browsing"],"threatSummary":"Malicious IP detected by multiple sources","detectedAt":"2025-01-06T12:00:00Z"}',
  NOW() + INTERVAL '24 hours',
  NOW()
);

-- 2. Insertar otra IP bloqueada automáticamente
INSERT INTO blocked_ips (ip_address, reason, notes, expires_at, created_at)
VALUES (
  '10.0.0.50',
  'Phishing site detected by Abuse.ch',
  '{"autoBlocked":true,"confidence":88,"sources":["abuse_ch_urlhaus"],"threatSummary":"Phishing site detected","detectedAt":"2025-01-06T11:30:00Z"}',
  NOW() + INTERVAL '24 hours',
  NOW()
);

-- 3. Insertar una IP bloqueada manualmente (para comparación)
INSERT INTO blocked_ips (ip_address, reason, notes, expires_at, created_at)
VALUES (
  '172.16.0.1',
  'Manual block - suspicious activity',
  NULL,
  NOW() + INTERVAL '7 days',
  NOW()
);

-- 4. Insertar una alerta de fraude generada por threat intelligence
-- Primero necesitamos un usuario de prueba (ajusta el user_id según tu base de datos)
-- Asumiendo que existe un usuario con ID '00000000-0000-0000-0000-000000000001'

INSERT INTO wallet_fraud_alerts (
  user_id,
  user_email,
  user_name,
  risk_score,
  risk_level,
  status,
  risk_factors,
  fraud_stats,
  created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001', -- Ajusta este ID
  'test@example.com',
  'Test User',
  0.95,
  'high',
  'pending',
  '[{"type":"malicious_ip","severity":"high","description":"IP address flagged by threat intelligence"}]'::jsonb,
  '{"ipAddress":"192.168.1.100","detectedSources":["virustotal","google_safe_browsing"],"confidence":95}'::jsonb,
  NOW()
);

-- 5. Insertar otra alerta de fraude
INSERT INTO wallet_fraud_alerts (
  user_id,
  user_email,
  user_name,
  risk_score,
  risk_level,
  status,
  risk_factors,
  fraud_stats,
  created_at
)
VALUES (
  '00000000-0000-0000-0000-000000000001', -- Ajusta este ID
  'suspicious@example.com',
  'Suspicious User',
  0.88,
  'high',
  'pending',
  '[{"type":"malicious_ip","severity":"high","description":"Phishing attempt detected"}]'::jsonb,
  '{"ipAddress":"10.0.0.50","detectedSources":["abuse_ch_urlhaus"],"confidence":88}'::jsonb,
  NOW()
);

-- Verificar los datos insertados
SELECT 
  ip_address,
  reason,
  notes,
  expires_at,
  created_at
FROM blocked_ips
ORDER BY created_at DESC
LIMIT 10;

SELECT 
  user_email,
  risk_score,
  risk_level,
  status,
  risk_factors,
  fraud_stats,
  created_at
FROM wallet_fraud_alerts
ORDER BY created_at DESC
LIMIT 10;

