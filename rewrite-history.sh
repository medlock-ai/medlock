#!/bin/bash

# Script to rewrite git history to remove sensitive KV namespace IDs

echo "⚠️  WARNING: This will rewrite git history!"
echo "Make sure you have a backup of your repository before proceeding."
echo ""
read -p "Continue? (y/N) " -n 1 -r
echo ""

if [[ ! $REPLY =~ ^[Yy]$ ]]
then
    exit 1
fi

# KV Namespace IDs to replace
declare -A replacements=(
    ["e1a58b0c701f447fa6b612b57253fcaa"]="YOUR_TOKENS_NAMESPACE_ID"
    ["054f9e43724148e5b02ef88e2ded3236"]="YOUR_TOKENS_PREVIEW_ID"
    ["17cf1513be614f7bad48dec0313750ba"]="YOUR_AUDIT_NAMESPACE_ID"
    ["8d057aae43c94933966a8939d7381d7a"]="YOUR_AUDIT_PREVIEW_ID"
    ["34ba45635a114b1e81124b0da35d7eed"]="YOUR_WAITLIST_KV_ID"
    ["08c9d9d31de44ed4aca7bf7c9d05e502"]="YOUR_WAITLIST_KV_PREVIEW_ID"
)

# Create filter script
cat > /tmp/filter.sh << 'EOF'
#!/bin/bash
for file in $(git ls-files); do
    if [[ -f "$file" ]]; then
        temp_file=$(mktemp)
        cp "$file" "$temp_file"
        
        # Replace KV namespace IDs
        sed -i '' \
            -e 's/e1a58b0c701f447fa6b612b57253fcaa/YOUR_TOKENS_NAMESPACE_ID/g' \
            -e 's/054f9e43724148e5b02ef88e2ded3236/YOUR_TOKENS_PREVIEW_ID/g' \
            -e 's/17cf1513be614f7bad48dec0313750ba/YOUR_AUDIT_NAMESPACE_ID/g' \
            -e 's/8d057aae43c94933966a8939d7381d7a/YOUR_AUDIT_PREVIEW_ID/g' \
            -e 's/34ba45635a114b1e81124b0da35d7eed/YOUR_WAITLIST_KV_ID/g' \
            -e 's/08c9d9d31de44ed4aca7bf7c9d05e502/YOUR_WAITLIST_KV_PREVIEW_ID/g' \
            "$temp_file"
        
        if ! cmp -s "$file" "$temp_file"; then
            mv "$temp_file" "$file"
        else
            rm "$temp_file"
        fi
    fi
done
EOF

chmod +x /tmp/filter.sh

echo "Rewriting history..."
git filter-branch --tree-filter /tmp/filter.sh --tag-name-filter cat -- --all

echo "Cleaning up..."
rm /tmp/filter.sh

echo ""
echo "✅ History rewrite complete!"
echo ""
echo "⚠️  IMPORTANT: Force push will be required to update remote repository"
echo "Run: git push --force --all"
echo ""
echo "Also clean up backup refs with:"
echo "git for-each-ref --format='delete %(refname)' refs/original | git update-ref --stdin"