#!/bin/bash

###############################################################################
# PDF SIZE REDUCER - GhostScript Compression Wrapper
# 
# Best compression tool with 40-70% size reduction
# Usage: ./compress_ghostscript.sh input.pdf [output.pdf] [quality]
###############################################################################

set -euo pipefail

# Color codes for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Script directory
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# Configuration
INPUT_PDF="${1:?Error: Input PDF file required}"
OUTPUT_PDF="${2:-${INPUT_PDF%.*}_compressed.pdf}"
QUALITY="${3:-ebook}"  # screen, ebook, printer, prepress
TEMP_DIR=$(mktemp -d)

cleanup() {
    rm -rf "$TEMP_DIR"
}
trap cleanup EXIT

# Function: Print with color
print_status() {
    echo -e "${BLUE}[$(date '+%H:%M:%S')]${NC} $1"
}

print_success() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${YELLOW}ℹ️  $1${NC}"
}

# Validate input
if [ ! -f "$INPUT_PDF" ]; then
    print_error "Input file not found: $INPUT_PDF"
    exit 1
fi

# Check GhostScript installation
if ! command -v gs &> /dev/null; then
    print_error "GhostScript is not installed!"
    print_info "Install with: sudo apt-get install ghostscript (Linux)"
    print_info "Or: brew install ghostscript (macOS)"
    exit 1
fi

# Get file size
get_file_size() {
    local size=$(stat -f%z "$1" 2>/dev/null || stat -c%s "$1" 2>/dev/null)
    echo $((size / 1024 / 1024))
}

# Validate quality setting
case "$QUALITY" in
    screen|ebook|printer|prepress)
        ;;
    *)
        print_error "Invalid quality: $QUALITY"
        print_info "Valid options: screen, ebook, printer, prepress"
        exit 1
        ;;
esac

print_status "Starting PDF compression"
print_info "Input: $INPUT_PDF"
print_info "Output: $OUTPUT_PDF"
print_info "Quality: $QUALITY"

ORIGINAL_SIZE=$(get_file_size "$INPUT_PDF")
print_info "Original file size: ${ORIGINAL_SIZE}MB"

# Compression with GhostScript
print_status "Running GhostScript compression..."

gs \
    -sDEVICE=pdfwrite \
    -dCompatibilityLevel=1.4 \
    -dPDFSETTINGS=/$QUALITY \
    -dNOPAUSE \
    -dQUIET \
    -dBATCH \
    -dDetectDuplicateImages \
    -r150x150 \
    -dCompressFonts=true \
    -r150x150 \
    -sOutputFile="$OUTPUT_PDF" \
    "$INPUT_PDF"

# Verify output
if [ ! -f "$OUTPUT_PDF" ]; then
    print_error "Compression failed - output file not created"
    exit 1
fi

COMPRESSED_SIZE=$(get_file_size "$OUTPUT_PDF")
REDUCTION=$(( (ORIGINAL_SIZE - COMPRESSED_SIZE) * 100 / ORIGINAL_SIZE ))

print_success "Compression completed!"
print_info "Compressed file size: ${COMPRESSED_SIZE}MB"
print_info "Size reduction: ${REDUCTION}%"

# Verify PDF integrity
print_status "Verifying PDF integrity..."
if gs -q -sDEVICE=nullpage -dBATCH "$OUTPUT_PDF" >/dev/null 2>&1; then
    print_success "PDF integrity verified"
else
    print_error "Warning: PDF integrity check failed"
fi

# Summary
echo -e "\n${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "${GREEN}Compression Summary${NC}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
echo -e "Original Size:    ${ORIGINAL_SIZE}MB"
echo -e "Compressed Size:  ${COMPRESSED_SIZE}MB"
echo -e "Reduction:        ${REDUCTION}%"
echo -e "Output:           ${OUTPUT_PDF}"
echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}\n"

exit 0
