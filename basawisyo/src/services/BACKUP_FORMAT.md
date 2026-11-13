# BasaWisyo JSON backup

The admin export creates a UTF-8 JSON file with `format: "BasaWisyoBackup"` and
`version: 1`. It contains `exportDate` (ISO timestamp), `school`, `users`,
`assignments`, `guestTokens`, `customPassages`, and `systemState`. The last field
contains reading progress and display settings from `basa_wisyo_state_v2`.
The current login session is deliberately excluded.

Restore accepts version 1 and legacy unversioned exports that contain a valid
`exportDate` and all the same data categories. It rejects unsupported versions,
missing fields, invalid records, duplicate users or passage IDs, malformed
JSON, and files larger than 10 MB. Existing local storage stays intact when
validation fails or the user cancels. After confirmation, restore writes all
supported categories and clears the current session so the user signs in to
the restored account set. A storage write error triggers a rollback to the
previous values; if rollback itself fails, the UI reports that explicitly.
The same valid backup can be restored repeatedly.

This is a local prototype format, not a secure account archive. The `users`
array currently includes plaintext demo passwords. Keep exported files private
and do not store real student data in this build.
