TIMEFORMAT='%R'
time curl "https://api.moonshot.ai/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $MOONSHOT_API_KEY" \
    -d "{\"model\": \"kimi-k3.1-pro\",\"messages\": [{\"role\": \"user\", \"content\": \"introduce yourself in terse manner, include any known techical spec\"}]}"
