#!/bin/bash

# Qdrant RAG Database Sync Script  
# Author: Zeno Sartori
# Description: Sincronizza tutti i client RAG con Qdrant

# === LOGGING SETUP ===
LOG_FILE="/tmp/sync-rag.log"
exec > >(tee -a "$LOG_FILE") 2>&1

echo "=== RAG Sync started at $(date) ===" 
echo "Logging to: $LOG_FILE"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
PURPLE='\033[0;35m'
CYAN='\033[0;36m'
NC='\033[0m' # No Color

# Configuration
QDRANT_PROJECT="$(pwd)"  # Use current directory
OBSIDIAN_BASE="${OBSIDIAN_BASE:-$HOME/Documents/vault}"  # Default vault path (customize)

# Function to print colored output
print_status() {
    echo -e "${BLUE}[$(date +%H:%M:%S)]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅${NC} $1"
}

print_error() {
    echo -e "${RED}❌${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}⚠️${NC} $1"
}

print_info() {
    echo -e "${CYAN}ℹ️${NC} $1"
}

# Change to project directory first
cd "$QDRANT_PROJECT" || {
    echo "❌ Cannot access project directory: $QDRANT_PROJECT"
    exit 1
}

# Load environment variables from .env file with FULL PATH
if [ -f ".env" ]; then
    set -a  # Automatically export all variables
    source .env
    set +a  # Turn off automatic export
    print_status "✅ Loaded environment from .env file"
    print_info "  QDRANT_URL: ${QDRANT_URL:-'not set'}"
    print_info "  LM_STUDIO_URL: ${LM_STUDIO_URL:-'not set'}"
    if [ ! -z "$QDRANT_API_KEY" ]; then
        print_info "  QDRANT_API_KEY: ${QDRANT_API_KEY:0:20}..."
    else
        print_info "  QDRANT_API_KEY: (not set)"
    fi
else
    print_warning "❌ No .env file found in $QDRANT_PROJECT"
    print_error "Cannot proceed without environment configuration"
    exit 1
fi

# Validate critical environment variables
if [ -z "$QDRANT_URL" ] || [ -z "$LM_STUDIO_URL" ]; then
    print_error "Missing critical environment variables!"
    print_info "Required: QDRANT_URL, LM_STUDIO_URL"
    exit 1
fi

# ASCII Art Header
clear
echo -e "${PURPLE}"
echo "╔═══════════════════════════════════════════════════════════╗"
echo "║              🚀 QDRANT RAG SYNC TOOL 🚀                  ║"
echo "║           LM Studio + BGE-M3 + Qwen3 + Qdrant            ║"
echo "║                  Multi-Client RAG System                  ║"
echo "╚═══════════════════════════════════════════════════════════╝"
echo -e "${NC}"

# Configuration
QDRANT_PROJECT="$(pwd)"  # Use current directory
OBSIDIAN_BASE="${OBSIDIAN_BASE:-$HOME/Documents/vault}"  # Default vault path (customize)

# Check if project exists
if [ ! -d "$QDRANT_PROJECT" ]; then
    print_error "Qdrant project not found at $QDRANT_PROJECT"
    print_info "Make sure you're running this script from the qdrant-mcp-hybrid directory"
    exit 1
fi

# Check if Obsidian vault exists
if [ ! -d "$OBSIDIAN_BASE" ]; then
    print_error "Obsidian vault not found at $OBSIDIAN_BASE"
    print_info "Please update OBSIDIAN_BASE path in the script"
    exit 1
fi

# Check if LM Studio is running
check_lm_studio() {
    print_status "Checking LM Studio connection..."
    if curl -s "$LM_STUDIO_URL/v1/models" > /dev/null 2>&1; then
        print_success "LM Studio is running"
    else
        print_warning "LM Studio not accessible at $LM_STUDIO_URL"
        print_info "Make sure LM Studio is running with the server started"
        read -p "Continue anyway? [y/N]: " -n 1 -r
        echo
        if [[ ! $REPLY =~ ^[Yy]$ ]]; then
            exit 1
        fi
    fi
}

# Check Qdrant connection (cloud or local)
check_qdrant() {
    print_status "Checking Qdrant connection..."
    print_info "URL: $QDRANT_URL"
    
    # Try with API key if available
    if [ ! -z "$QDRANT_API_KEY" ]; then
        if curl -s -H "api-key: $QDRANT_API_KEY" "$QDRANT_URL/collections" > /dev/null 2>&1; then
            print_success "Qdrant Cloud connected successfully"
            return 0
        fi
    else
        # Try without API key (local instance)
        if curl -s "$QDRANT_URL/collections" > /dev/null 2>&1; then
            print_success "Qdrant local instance connected"
            return 0
        fi
    fi
    
    print_error "Cannot connect to Qdrant at $QDRANT_URL"
    print_info "Check your QDRANT_URL and QDRANT_API_KEY in .env file"
    print_info "For cloud: https://cloud.qdrant.io"
    
    read -p "Continue anyway? [y/N]: " -n 1 -r
    echo
    if [[ ! $REPLY =~ ^[Yy]$ ]]; then
        exit 1
    fi
}

# Function to sync a client
sync_client() {
    local client_name=$1
    local source_dir="$OBSIDIAN_BASE/$2"
    
    print_status "🔄 Syncing client: $client_name"
    print_info "Source directory: $source_dir"
    
    if [ -d "$source_dir" ]; then
        # Count files to process with VERBOSE output
        print_status "Scanning for documents..."
        local file_count=$(find "$source_dir" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.pdf" -o -name "*.docx" \) | wc -l | tr -d ' ')
        print_info "📁 Found $file_count documents in $(basename "$source_dir")"
        
        # Show some example files found
        if [ "$file_count" -gt 0 ]; then
            print_info "Example files found:"
            find "$source_dir" -type f \( -name "*.md" -o -name "*.txt" -o -name "*.pdf" -o -name "*.docx" \) | head -3 | while read file; do
                print_info "  • $(basename "$file")"
            done
        else
            print_warning "❌ NO FILES FOUND! Check if directory has .md/.txt/.pdf/.docx files"
            return 1
        fi
        
        # Change to project directory
        cd "$QDRANT_PROJECT" || exit 1
        print_status "Working directory: $(pwd)"
        
        # Build if needed
        if [ ! -d "dist" ]; then
            print_status "Building project..."
            npm run build
        fi
        
        # Run the seed command with explicit environment variables
        print_status "Seeding $client_name..."
        echo ""
        
        # Use FULL PATH to npm and ensure all environment is passed
        # Handle nvm installations
        if [ -f "$HOME/.nvm/nvm.sh" ]; then
            source "$HOME/.nvm/nvm.sh"
            print_info "Loaded nvm environment"
        fi
        
        if /usr/local/bin/npm --version >/dev/null 2>&1; then
            NPM_CMD="/usr/local/bin/npm"
        elif /opt/homebrew/bin/npm --version >/dev/null 2>&1; then
            NPM_CMD="/opt/homebrew/bin/npm"  
        elif [ -f "$HOME/.nvm/versions/node/v22.17.1/bin/npm" ]; then
            NPM_CMD="$HOME/.nvm/versions/node/v22.17.1/bin/npm"
        elif command -v npm >/dev/null 2>&1; then
            NPM_CMD=$(which npm)
        else
            print_error "npm not found! Please install Node.js and npm"
            return 1
        fi
        
        print_info "Using npm at: $NPM_CMD"
        
        # Pass environment variables explicitly to npm
        if env QDRANT_URL="$QDRANT_URL" \
               QDRANT_API_KEY="$QDRANT_API_KEY" \
               LM_STUDIO_URL="$LM_STUDIO_URL" \
               EMBEDDING_MODEL="$EMBEDDING_MODEL" \
               EMBEDDING_DIM="$EMBEDDING_DIM" \
               LLM_MODEL="$LLM_MODEL" \
               CLIENT_COLLECTIONS="$CLIENT_COLLECTIONS" \
               DEBUG="$DEBUG" \
               "$NPM_CMD" run seed -- --client "$client_name" --filesdir "$source_dir"; then
            echo ""
            print_success "✨ $client_name synced successfully!"
            
            # Show collection info via direct Qdrant API
            local catalog_collection="${client_name}_catalog"
            local chunks_collection="${client_name}_chunks"
            
            local catalog_count="?"
            local chunks_count="?"
            
            # Try to get stats with proper API key handling
            if [ ! -z "$QDRANT_API_KEY" ]; then
                catalog_count=$(curl -s -H "api-key: $QDRANT_API_KEY" "$QDRANT_URL/collections/$catalog_collection" 2>/dev/null | jq -r '.result.points_count // 0' 2>/dev/null || echo "?")
                chunks_count=$(curl -s -H "api-key: $QDRANT_API_KEY" "$QDRANT_URL/collections/$chunks_collection" 2>/dev/null | jq -r '.result.points_count // 0' 2>/dev/null || echo "?")
            else
                catalog_count=$(curl -s "$QDRANT_URL/collections/$catalog_collection" 2>/dev/null | jq -r '.result.points_count // 0' 2>/dev/null || echo "?")
                chunks_count=$(curl -s "$QDRANT_URL/collections/$chunks_collection" 2>/dev/null | jq -r '.result.points_count // 0' 2>/dev/null || echo "?")
            fi
            
            print_info "📊 Catalog entries: $catalog_count | Document chunks: $chunks_count"
        else
            echo ""
            print_error "💥 Failed to sync $client_name"
        fi
    else
        print_warning "Source directory not found: $source_dir"
    fi
    echo ""
}

# Pre-flight checks
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}Pre-flight Checks${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

check_lm_studio
check_qdrant

# Main sync section
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}🚀 Starting RAG Database Synchronization...${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Sync all clients (customize these with your own client names and paths)
sync_client "personal" "personal_docs"
sync_client "work" "work_documents"  
sync_client "research" "research_papers"
sync_client "projects" "project_files"

# Example with different paths:
# sync_client "client_a" "clients/client_a/documents"
# sync_client "client_b" "clients/client_b/files"

# Show final summary
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${BLUE}📊 Final Summary${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

print_status "RAG Collections Status:"

# Query Qdrant for all collections
if command -v curl &> /dev/null && command -v jq &> /dev/null; then
    # Build curl command based on whether we have API key
    if [ ! -z "$QDRANT_API_KEY" ]; then
        collections_response=$(curl -s -H "api-key: $QDRANT_API_KEY" "$QDRANT_URL/collections" 2>/dev/null)
    else
        collections_response=$(curl -s "$QDRANT_URL/collections" 2>/dev/null)
    fi
    
    if [ $? -eq 0 ]; then
        echo "$collections_response" | jq -r '.result.collections[].name' 2>/dev/null | while read collection; do
            if [[ $collection == *"catalog"* || $collection == *"chunks"* ]]; then
                # Get collection stats
                if [ ! -z "$QDRANT_API_KEY" ]; then
                    count=$(curl -s -H "api-key: $QDRANT_API_KEY" "$QDRANT_URL/collections/$collection" 2>/dev/null | jq -r '.result.points_count // 0' 2>/dev/null || echo "?")
                else
                    count=$(curl -s "$QDRANT_URL/collections/$collection" 2>/dev/null | jq -r '.result.points_count // 0' 2>/dev/null || echo "?")
                fi
                
                if [[ $collection == *"catalog"* ]]; then
                    echo "  📚 $collection: $count documents"
                else
                    echo "  📄 $collection: $count chunks"
                fi
            fi
        done
    else
        print_warning "Could not fetch collection stats (Qdrant not accessible)"
    fi
else
    print_warning "Install 'jq' for detailed collection stats: brew install jq"
fi

# Final message
echo ""
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo -e "${GREEN}✨🎉 RAG SYNC COMPLETED! 🎉✨${NC}"
echo -e "${PURPLE}Ready for semantic search across all your knowledge!${NC}"
echo -e "${BLUE}═══════════════════════════════════════════════════════════${NC}"
echo ""

# Add desktop notification if available (macOS)
if command -v osascript &> /dev/null; then
    osascript -e 'display notification "RAG sync completato! Log disponibile in /tmp/sync-rag.log" with title "🚀 Sync Database" subtitle "Tutti i client aggiornati"'
fi

# Play completion sound if available (macOS)
if command -v afplay &> /dev/null; then
    afplay /System/Library/Sounds/Glass.aiff 2>/dev/null
fi

print_success "Use these Claude tools to search your knowledge:"
print_info "• catalog_search - Find relevant documents"  
print_info "• chunks_search - Search specific content"
print_info "• all_chunks_search - Search across all clients"
print_info "• collection_info - Check system status"

echo "=== RAG Sync completed at $(date) ==="
echo "Log file: $LOG_FILE"