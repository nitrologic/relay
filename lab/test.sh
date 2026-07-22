curl "https://api.moonshot.ai/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MOONSHOT_API_KEY" \
    -d "{\"model\": \"kimi-k2.5\",\"messages\": [{\"role\": \"user\", \"content\": \"Tell us about yourself\"}]}"