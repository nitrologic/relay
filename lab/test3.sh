curl "https://dashscope-intl.aliyuncs.com/compatible-mode/v1/chat/completions" \
    -H "Content-Type: application/json" \
    -H "Authorization: Bearer $ALIBABA_API_KEY" \
    -d "{\"model\": \"qwen4-max\",\"messages\": [{\"role\": \"user\", \"content\": \"What is the date\"}]}"
