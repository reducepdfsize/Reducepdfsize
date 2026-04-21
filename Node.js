/**
 * PDF Size Reducer - Node.js PDF Compression Library
 * 
 * Usage:
 * const PDFCompressor = require('./pdf-compressor');
 * const compressor = new PDFCompressor({ quality: 'high' });
 * compressor.compress('input.pdf', 'output.pdf').then(() => console.log('Done!'));
 */

const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { promisify } = require('util');

const execAsync = promisify(exec);

class PDFCompressor {
    /**
     * Initialize PDF Compressor
     * @param {Object} options - Configuration options
     * @param {string} options.method - Compression method: 'ghostscript', 'imagemagick'
     * @param {string} options.quality - Quality level: 'low', 'medium', 'high', 'maximum'
     */
    constructor(options = {}) {
        this.method = options.method || 'ghostscript';
        this.quality = options.quality || 'high';
        this.originalSize = 0;
        this.compressedSize = 0;
        
        this.qualitySettings = {
            low: '/screen',
            medium: '/ebook',
            high: '/printer',
            maximum: '/prepress'
        };
    }

    /**
     * Get file size in MB
     */
    async getFileSize(filepath) {
        const stats = await fs.promises.stat(filepath);
        return stats.size / (1024 * 1024);
    }

    /**
     * Compress using GhostScript
     */
    async compressGhostscript(inputPdf, outputPdf) {
        const qualitySetting = this.qualitySettings[this.quality] || '/ebook';
        
        const command = `gs -sDEVICE=pdfwrite -dCompatibilityLevel=1.4 -dPDFSETTINGS=${qualitySetting} -dNOPAUSE -dQUIET -dBATCH -dDetectDuplicateImages -r150x150 -sOutputFile="${outputPdf}" "${inputPdf}"`;
        
        try {
            console.log(`🔄 Starting GhostScript compression with ${qualitySetting}`);
            await execAsync(command);
            console.log('✅ GhostScript compression completed');
            return true;
        } catch (error) {
            console.error('❌ GhostScript compression failed:', error.message);
            if (error.message.includes('not found')) {
                console.error('Install GhostScript: sudo apt-get install ghostscript');
            }
            return false;
        }
    }

    /**
     * Compress using ImageMagick
     */
    async compressImageMagick(inputPdf, outputPdf) {
        const qualityMap = {
            low: 30,
            medium: 60,
            high: 80,
            maximum: 90
        };
        const quality = qualityMap[this.quality] || 70;
        
        const command = `convert -quality ${quality} -density 150 "${inputPdf}" "${outputPdf}"`;
        
        try {
            console.log(`🔄 Starting ImageMagick compression (quality: ${quality})`);
            await execAsync(command);
            console.log('✅ ImageMagick compression completed');
            return true;
        } catch (error) {
            console.error('❌ ImageMagick compression failed:', error.message);
            if (error.message.includes('not found')) {
                console.error('Install ImageMagick: sudo apt-get install imagemagick');
            }
            return false;
        }
    }

    /**
     * Main compression method
     */
    async compress(inputPdf, outputPdf) {
        try {
            // Validate input
            if (!fs.existsSync(inputPdf)) {
                throw new Error(`Input file not found: ${inputPdf}`);
            }

            // Get original size
            this.originalSize = await this.getFileSize(inputPdf);
            console.log(`📊 Input file size: ${this.originalSize.toFixed(2)} MB`);
            console.log(`⚙️  Using compression method: ${this.method}`);
            console.log(`📋 Quality level: ${this.quality}`);

            // Run compression
            let success = false;
            if (this.method === 'ghostscript') {
                success = await this.compressGhostscript(inputPdf, outputPdf);
            } else if (this.method === 'imagemagick') {
                success = await this.compressImageMagick(inputPdf, outputPdf);
            } else {
                throw new Error(`Unknown compression method: ${this.method}`);
            }

            // Check output
            if (success && fs.existsSync(outputPdf)) {
                this.compressedSize = await this.getFileSize(outputPdf);
                const reduction = this.getReductionPercentage();

                console.log(`📊 Output file size: ${this.compressedSize.toFixed(2)} MB`);
                console.log(`📉 Size reduction: ${reduction.toFixed(1)}%`);

                return {
                    success: true,
                    originalSize: this.originalSize,
                    compressedSize: this.compressedSize,
                    reduction: reduction,
                    outputFile: outputPdf
                };
            }

            return { success: false, error: 'Compression failed' };

        } catch (error) {
            console.error('❌ Error:', error.message);
            return { success: false, error: error.message };
        }
    }

    /**
     * Batch compress multiple PDFs
     */
    async batchCompress(inputDir, outputDir = 'compressed') {
        try {
            // Create output directory
            if (!fs.existsSync(outputDir)) {
                fs.mkdirSync(outputDir, { recursive: true });
            }

            // Find all PDFs
            const files = fs.readdirSync(inputDir)
                .filter(f => f.toLowerCase().endsWith('.pdf'));

            if (files.length === 0) {
                console.log('⚠️  No PDF files found in directory');
                return;
            }

            console.log(`📂 Found ${files.length} PDF files to compress\n`);

            let totalOriginal = 0;
            let totalCompressed = 0;

            for (let i = 0; i < files.length; i++) {
                const inputFile = path.join(inputDir, files[i]);
                const outputFile = path.join(outputDir, files[i]);

                console.log(`[${i + 1}/${files.length}] Processing: ${files[i]}`);
                
                const result = await this.compress(inputFile, outputFile);
                
                if (result.success) {
                    totalOriginal += result.originalSize;
                    totalCompressed += result.compressedSize;
                }
            }

            // Summary
            const totalReduction = totalOriginal > 0 
                ? ((totalOriginal - totalCompressed) / totalOriginal * 100).toFixed(1)
                : 0;

            console.log('\n' + '='.repeat(50));
            console.log('📊 Batch Compression Summary');
            console.log('='.repeat(50));
            console.log(`Total original size:    ${totalOriginal.toFixed(2)} MB`);
            console.log(`Total compressed size:  ${totalCompressed.toFixed(2)} MB`);
            console.log(`Overall reduction:      ${totalReduction}%`);
            console.log('='.repeat(50) + '\n');

        } catch (error) {
            console.error('❌ Batch compression error:', error.message);
        }
    }

    /**
     * Get compression percentage
     */
    getReductionPercentage() {
        if (this.originalSize === 0) return 0;
        return ((this.originalSize - this.compressedSize) / this.originalSize) * 100;
    }
}

// Export for use as module
module.exports = PDFCompressor;

// CLI support
if (require.main === module) {
    const args = process.argv.slice(2);
    
    if (args.length < 1) {
        console.log('Usage: node pdf-compressor.js <input.pdf> [output.pdf] [--quality high]');
        process.exit(1);
    }

    const inputFile = args[0];
    const outputFile = args[1] || inputFile.replace(/\.pdf$/, '_compressed.pdf');
    const qualityArg = args.find(arg => arg.startsWith('--quality'));
    const quality = qualityArg ? qualityArg.split('=')[1] : 'high';

    const compressor = new PDFCompressor({ quality });
    compressor.compress(inputFile, outputFile)
        .then(result => {
            process.exit(result.success ? 0 : 1);
        })
        .catch(error => {
            console.error(error);
            process.exit(1);
        });
}
