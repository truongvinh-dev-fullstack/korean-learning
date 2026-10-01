# Supabase database CA

`supabase-ca.crt` is a public certificate, not a credential. It was downloaded from the Supabase certificate distribution endpoint:

https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt

Subject: Supabase Root 2021 CA. SHA-256 fingerprint:

`80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`

Use `sslmode=verify-full&sslrootcert=certs/supabase-ca.crt` in the production database URLs. If Supabase changes its CA, obtain the replacement from Database Settings > SSL Configuration and update this file and its fingerprint.
