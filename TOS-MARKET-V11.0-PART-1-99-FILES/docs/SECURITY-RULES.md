# Security rules

Passwords remain bcrypt hashes. Admin credentials belong in environment variables. JWT secret must be generated server-side if absent. Do not expose database credentials, private keys or mailbox passwords.
