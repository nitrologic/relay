curl "https://api.moonshot.ai/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MOONSHOT_API_KEY" \
    -d "{\"model\": \"kimi-k3\",\"messages\": [{\"role\": \"user\", \"content\": \"What is the date\"}]}"
