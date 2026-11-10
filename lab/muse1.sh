curl "https://api.meta.ai/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $META_API_KEY" \
    -d "{\"model\": \"muse-ember-1.0\",\"messages\": [{\"role\": \"user\", \"content\": \"what is the date and your identify\"}]}"
