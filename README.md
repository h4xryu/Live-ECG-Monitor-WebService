# Live-ECG-Monitor-WebService


## Overview

Live-ECG-Monitor-WebService is a comprehensive tool for analyzing electrocardiogram (ECG) data, detecting arrhythmias, and visualizing heart activity. This application provides real-time monitoring, file-based analysis, and machine learning-based classification of ECG segments.

##  Features

- **ECG Data Visualization**: Real-time and static visualization of ECG signals
- **R-Peak Detection**: Advanced algorithms for accurate R-peak detection
- **Segment Extraction**: Extract and analyze ECG segments around R-peaks
- **Arrhythmia Classification**: ML-based classification of ECG segments into arrhythmia types
- **Grid View**: Multi-segment visualization for comparative analysis
- **Model Management**: Upload, select, and manage ONNX classification models
- **File Support**: Import ECG data from CSV, TXT, and NPY files
- **Performance Optimization**: Memory-efficient data structures for large ECG datasets

##  Screenshots


##  Installation

### Prerequisites

- Node.js 18.0 or higher
- npm or yarn

### Setup

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/ecg-analysis-app.git
   cd ecg-analysis-app


## Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/ecg-monitoring-dashboard.git

# Navigate to the project directory
cd ecg-monitoring-dashboard

# Install dependencies
npm install

# Start the development server
npm run dev
```
##  Usage

### Loading ECG Data

1. Navigate to the "File Upload" tab
2. Upload your ECG data file (CSV, TXT, or NPY format)
3. Alternatively, use the test data generators for quick testing


### Visualizing ECG Data

1. After loading data, the application automatically switches to the visualization tab
2. Use mouse wheel to zoom in/out
3. Drag to pan the view
4. Click on an R-peak to select it for detailed analysis


### R-Peak Detection

1. Navigate to the "ECG Visualization" tab
2. Click "Detect All R-Peaks" button
3. Adjust detection parameters in the settings if needed


### Segment Analysis

1. Select an R-peak by clicking on it
2. The application extracts a segment around the selected R-peak
3. Navigate to the "Grid View" tab to see all segments


### Arrhythmia Classification

1. Navigate to the "Model Analysis" tab
2. Select a classification model
3. Click "Classify Segment" to analyze the selected segment
4. View classification results and confidence scores


### Key Components

- **Data Management**: Handles data loading, buffering, and processing
- **Visualization**: Renders ECG signals, R-peaks, and grid views
- **Analysis**: Performs R-peak detection, segment extraction, and classification
- **Model Management**: Handles model loading, selection, and inference


##  Algorithms

### R-Peak Detection

The application uses an enhanced Pan-Tompkins algorithm with wavelet denoising for R-peak detection:

1. Signal preprocessing (wavelet denoising)
2. High-pass filtering to remove baseline wander
3. Derivative calculation to emphasize QRS complexes
4. Squaring to make all values positive
5. Moving window integration
6. Adaptive thresholding for peak detection


### Segment Extraction

Segments are extracted around detected R-peaks:

1. Calculate segment boundaries based on R-peak position
2. Extract data within boundaries
3. Apply padding if necessary to ensure consistent length
4. Normalize segment data for classification


### Arrhythmia Classification

The application supports classification of ECG segments into five classes:



##  Technical Details

### Data Structures

- **EnhancedCircularBuffer**: Memory-efficient data structure for ECG data
- **ECGProcessor**: Signal processing and feature extraction


### Performance Optimizations

- **Batch Processing**: Efficient handling of large datasets
- **Memory Management**: Optimized data structures for minimal memory usage
- **Downsampling**: Automatic downsampling for very large files


##  Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request


##  License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

##  Acknowledgements

- [Next.js](https://nextjs.org/) - The React framework used
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [ONNX Runtime](https://onnxruntime.ai/) - For model inference
- [MIT-BIH Arrhythmia Database](https://physionet.org/content/mitdb/1.0.0/) - For test data and model training
