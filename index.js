document.addEventListener('DOMContentLoaded', () => {
    const API_URL = 'https://api.spot-hinta.fi/TodayAndDayForward';
    const loadingIndicator = document.getElementById('loading-indicator');
    const errorMessage = document.getElementById('error-message');
    const chartDiv = document.getElementById('spot-price-chart');

    async function fetchData() {
        try {
            const response = await fetch(API_URL);
            if (!response.ok) {
                throw new Error(`HTTP error! status: ${response.status}`);
            }
            const data = await response.json();
            return data;
        } catch (error) {
            console.error('Error fetching data:', error);
            showError('Failed to load electricity price data. Please try again later.');
            return null;
        }
    }

    function processData(data) {
        // API returns data sorted, but let's ensure it's sorted by time
        data.sort((a, b) => new Date(a.DateTime) - new Date(b.DateTime));

        const x = data.map(item => item.DateTime);
        const y = data.map(item => item.PriceWithTax * 100); // Convert to cents/kWh if needed, assuming input is EUR/kWh. 
        // Checking the API sample from research: PriceWithTax was ~0.10, which is 10 cents. 
        // Usually people want to see cents. Let's check the magnitude.
        // If PriceWithTax is around 0.1, that's Euros. So * 100 gives cents.

        return { x, y };
    }

    function updateStats(data) {
        const today = new Date().toISOString().split('T')[0];

        // Helper to get tomorrow's date string YYYY-MM-DD
        const tomorrowDate = new Date();
        tomorrowDate.setDate(tomorrowDate.getDate() + 1);
        const tomorrow = tomorrowDate.toISOString().split('T')[0];

        const todayPrices = data.filter(item => item.DateTime.startsWith(today));
        const tomorrowPrices = data.filter(item => item.DateTime.startsWith(tomorrow));

        const calculateAverage = (items) => {
            if (items.length === 0) return null;
            const sum = items.reduce((acc, item) => acc + item.PriceWithTax, 0);
            return (sum / items.length * 100).toFixed(2); // Convert to cents
        };

        const avgToday = calculateAverage(todayPrices);
        const avgTomorrow = calculateAverage(tomorrowPrices);

        // Find lowest price in the future dataset
        const now = new Date();
        const futurePrices = data.filter(item => new Date(item.DateTime) > now);

        let minPrice = '--';
        let minPriceTime = '';

        if (futurePrices.length > 0) {
            const minPriceItem = futurePrices.reduce((min, item) => item.PriceWithTax < min.PriceWithTax ? item : min, futurePrices[0]);
            minPrice = (minPriceItem.PriceWithTax * 100).toFixed(2);
            const date = new Date(minPriceItem.DateTime);
            minPriceTime = `at ${date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;

            // Add day info if it's tomorrow
            const todayStr = now.toISOString().split('T')[0];
            if (!minPriceItem.DateTime.startsWith(todayStr)) {
                minPriceTime += ' (Tom)';
            }
        }

        // Update DOM
        document.getElementById('avg-today').textContent = avgToday || '--';
        document.getElementById('avg-tomorrow').textContent = avgTomorrow || '--';
        document.getElementById('lowest-price').textContent = minPrice;
        document.getElementById('lowest-price-time').textContent = minPriceTime;

        // Update subtitle with date range
        if (data.length > 0) {
            const startDate = new Date(data[0].DateTime);
            const endDate = new Date(data[data.length - 1].DateTime);

            const formatDate = (date) => date.toLocaleDateString('fi-FI', { day: 'numeric', month: 'numeric' });
            const dateRange = `${formatDate(startDate)} - ${formatDate(endDate)}`;

            document.querySelector('.subtitle').textContent = `Finland (FI) - Hourly Prices (inc. Tax) for ${dateRange}`;
        }
    }

    function renderChart(chartData) {
        const trace = {
            x: chartData.x,
            y: chartData.y,
            type: 'scatter',
            mode: 'lines', // simplified from lines+markers for cleaner look with many points
            fill: 'tozeroy',
            line: {
                color: '#38bdf8',
                width: 3,
                shape: 'spline' // smooth curves
            },
            fillcolor: 'rgba(56, 189, 248, 0.1)',
            hovertemplate: '%{y:.2f} c/kWh<br>%{x|%H:%M}<extra></extra>'
        };

        const layout = {
            paper_bgcolor: 'rgba(0,0,0,0)',
            plot_bgcolor: 'rgba(0,0,0,0)',
            font: {
                family: 'Inter, sans-serif',
                color: '#94a3b8'
            },
            margin: { t: 20, r: 20, b: 40, l: 60 },
            xaxis: {
                gridcolor: '#334155',
                zerolinecolor: '#334155',
                tickformat: '%H:%M',
                nticks: 12
            },
            yaxis: {
                title: 'Price (c/kWh)',
                gridcolor: '#334155',
                zerolinecolor: '#334155',
                gridwidth: 1,
                zerolinewidth: 1
            },
            hovermode: 'x unified',
            shapes: [{
                type: 'line',
                x0: new Date(),
                y0: 0,
                x1: new Date(),
                y1: 1,
                xref: 'x',
                yref: 'paper',
                line: {
                    color: '#ef4444',
                    width: 2,
                    dash: 'dash'
                }
            }]
        };

        const config = {
            responsive: true,
            displayModeBar: false
        };

        Plotly.newPlot(chartDiv, [trace], layout, config);
    }

    function showError(message) {
        loadingIndicator.classList.add('hidden');
        errorMessage.textContent = message;
        errorMessage.classList.remove('hidden');
    }

    async function init() {
        const data = await fetchData();
        if (data) {
            updateStats(data);
            const chartData = processData(data);
            loadingIndicator.classList.add('hidden');
            renderChart(chartData);
        }
    }

    init();
});
