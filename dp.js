document.addEventListener("DOMContentLoaded", function () {
    const dataUrl = "https://projects.fivethirtyeight.com/polls/data/president_polls.csv";
    const weightsUrl = "https://raw.githubusercontent.com/seppukusoft/538-bias-marker/main/list.json";
    const electoralVotesMapping = {
      "Alabama": 9, "Alaska": 3, "Arizona": 11, "Arkansas": 6, "California": 54, "Colorado": 10, "Connecticut": 7, "Delaware": 3, "District of Columbia": 3,
      "Florida": 30, "Georgia": 16, "Hawaii": 4, "Idaho": 4, "Illinois": 19, "Indiana": 11, "Iowa": 6, "Kansas": 6, "Kentucky": 8, "Louisiana": 8, "Maine": 2,
      "Maine CD-1": 1, "Maine CD-2": 1, "Maryland": 10, "Massachusetts": 11, "Michigan": 15, "Minnesota": 10, "Mississippi": 6, "Missouri": 10, "Montana": 4,
      "Nebraska": 4, "Nebraska CD-2": 1, "Nevada": 6, "New Hampshire": 4, "New Jersey": 14, "New Mexico": 5, "New York": 28, "North Carolina": 16, "North Dakota": 3,
      "Ohio": 17, "Oklahoma": 7, "Oregon": 8, "Pennsylvania": 19, "Rhode Island": 4, "South Carolina": 9, "South Dakota": 3, "Tennessee": 11, "Texas": 40,
      "Utah": 6, "Vermont": 3, "Virginia": 13, "Washington": 12, "West Virginia": 4, "Wisconsin": 10, "Wyoming": 3
    };
  
    let data = [], weights = {}, x = 45; // Default value for x

    // Load data and initialize dropdowns
    checkURL(dataUrl).then(isReachable => {
        if (!isReachable) return console.error("CSV URL is not reachable");
        Promise.all([fetchAndParseCSV(dataUrl), fetchPollsterWeights(weightsUrl)]).then(([fetchedData, fetchedWeights]) => {
            data = fetchedData;
            weights = fetchedWeights;
            populateDropdown(data);
            displayTotalElectoralVotes(calculateTotalElectoralVotes(data));
        });
    });

    // Fetch and parse CSV data
    async function fetchAndParseCSV(url) {
        const response = await fetch(url);
        const csvText = await response.text();
        return Papa.parse(csvText, { header: true, dynamicTyping: true }).data.filter(d => d.state); // Filter out rows where state is null
    }

    // Fetch pollster weights from the JSON file
    async function fetchPollsterWeights(url) {
        const response = await fetch(url);
        const json = await response.json();
        return json[0];
    }

    // Check if the CSV URL is reachable
    async function checkURL(url) {
        try {
            return (await fetch(url, { method: 'HEAD' })).ok;
        } catch (error) {
            return false;
        }
    }
    
    async function fetchAndUpdateResults(selectedState) {
        // Re-fetch and filter data
        const filteredData = await fetchAndParseCSV(dataUrl);
        data = filterByRecentDates(filteredData); // Filter the fetched data based on the updated x value
    
        // Update state dropdown based on the filtered data
        updateStateDropdown();
    
        // Update results for the selected state
        updateResults(selectedState);
    } 

    function countPollsByState(data) {
        const pollCounts = {};
    
        // Count polls for each state
        data.forEach(poll => {
            const state = poll.state;
            if (state) {
                pollCounts[state] = (pollCounts[state] || 0) + 1;
            }
        });
    
        return pollCounts;
    }
    
    function updateStateDropdown() {
        const dropdown = document.getElementById("stateDropdown");
        dropdown.innerHTML = ""; // Clear existing options
    
        const pollCounts = countPollsByState(data); // Get the poll counts
        const statesWithSufficientPolls = Object.keys(pollCounts).filter(state => pollCounts[state] >= 20);
    
        // Populate dropdown with filtered states
        statesWithSufficientPolls.forEach(state => {
            const option = document.createElement("option");
            option.value = state;
            option.text = state;
            dropdown.appendChild(option);
        });
    }
    
    // Update state results when a dropdown selection changes
    function updateResults(selectedState) {
        let filteredData;
        // Filter based on selected state
        if (selectedState === "select") {
            filteredData = data.filter(d => d.state && d.state.toLowerCase() === "select");
        } else {
            filteredData = data.filter(d => d.state === selectedState);
        }
        // Further filter to only include polls from the last x days
        filteredData = filterByRecentDates(filteredData).filter(d => d.candidate_name.toLowerCase() !== "joe biden" && d.candidate_name.toLowerCase() !== "robert f. kennedy");
        if (filteredData.length === 0) {
            console.log(`No data found for state: ${selectedState}`);
            return;
        }
        // Inside the updateResults function, after filtering data
        const weightedData = calculateWeightedPolls(filteredData, weights);
        // Group candidates and calculate mean weighted percentage
        const candidatesData = Array.from(d3.group(weightedData, d => d.candidate_name), ([name, group]) => ({ 
            name, percentage: d3.mean(group, d => d.weightedPct) 
        }))
        .filter(candidate => candidate.percentage >= 0.15); // Only include candidates with at least 0.15%
        // Normalize percentages to ensure they sum up to 100%
        const totalPercentage = d3.sum(candidatesData, d => d.percentage);
        candidatesData.forEach(candidate => {
            candidate.percentage = (candidate.percentage / totalPercentage) * 100;
        });
        // Display popular vote estimate for candidates with percentage >= 0.15%
        const voteShareText = candidatesData.map(candidate => `${candidate.name}: ${candidate.percentage.toFixed(2)}%`).join(", ");
        d3.select("#voteShare").text(`Popular Vote Estimate: ${voteShareText}`);
        // Calculate and display win probabilities for candidates with at least 2% probability
        const winProbabilities = calculateWinProbability(candidatesData);
        const probabilityText = Object.entries(winProbabilities).filter(([_, prob]) => prob > 0.5).map(([candidate, prob]) => `${candidate}: ${prob.toFixed(2)}%`).join(", ");
        d3.select("#probability").text(`Win Probability: ${probabilityText}`);
        // Calculate and display total electoral votes
        displayTotalElectoralVotes(calculateTotalElectoralVotes(data));
    }

    // Filter data based on date range
    function filterByRecentDates(data) {
        const now = new Date();
        const daysAgo = new Date();
        daysAgo.setDate(now.getDate() - x); // Use the global x variable for filtering
    
        return data.filter(d => {
            const pollDate = new Date(d.end_date); // Adjust if your CSV uses a different date column
            return pollDate >= daysAgo && pollDate <= now;
        });
    }    

    // Calculate weighted percentages based on pollster and sponsor weights
    function calculateWeightedPolls(pollData, weights) {
        return pollData.map(poll => {
            const pollsterWeight = getWeight(poll.pollster, weights);
            const sponsorWeight = getWeight(poll.sponsor, weights);
            return { ...poll, weightedPct: poll.pct * Math.min(pollsterWeight, sponsorWeight) };
        });
    }

    // Helper to get weight based on the category (pollster/sponsor)
    function getWeight(name, weights) {
        if (!name) return 1;
        if (weights.red.includes(name)) return 0.3;
        if (weights.leanred.includes(name)) return 0.75;
        if (weights.leanblue.includes(name)) return 0.75;
        if (weights.blue.includes(name)) return 0.3;
        if (weights.unreliable.includes(name)) return 0.1;
        if (weights.relmissing.includes(name)) return 1.2;
        return 1;
    }

    // Calculate win probability using Monte Carlo simulations
    function calculateWinProbability(candidates, iterations = 1000000) {
        const results = candidates.reduce((acc, { name }) => ({ ...acc, [name]: 0 }), {});
        for (let i = 0; i < iterations; i++) {
            const randomResults = candidates.map(candidate => ({ name: candidate.name, result: candidate.percentage + (Math.random() - 0.9) * 40 }));
            results[randomResults.reduce((prev, curr) => (curr.result > prev.result ? curr : prev)).name] += 1;
        }
        return Object.fromEntries(Object.entries(results).map(([name, count]) => [name, (count / iterations) * 100]));
    }

    // Calculate total electoral votes for all states
    function calculateTotalElectoralVotes(data) {
        const totalElectoralVotes = {};
    
        // Process each state
        Object.keys(electoralVotesMapping).forEach(state => {
            const stateData = data.filter(d => d.state === state);
    
            // Filter data for the last 3 weeks
            const recentData = filterByRecentDates(stateData);
    
            if (recentData.length > 0) {
                // Group candidates by name
                const candidates = d3.group(recentData, d => d.candidate_name);
    
                let highestPercentage = -Infinity;
                let winningCandidate = null;
    
                // Find the candidate with the highest percentage in each state
                candidates.forEach((candidateData, candidateName) => {
                    const percentage = d3.mean(candidateData, d => d.pct);
                    if (percentage > highestPercentage) {
                        highestPercentage = percentage;
                        winningCandidate = candidateName;
                    }
                });
    
                if (winningCandidate) { // Add the electoral votes for the winning candidate in this state
                    totalElectoralVotes[winningCandidate] = (totalElectoralVotes[winningCandidate] || 0) + electoralVotesMapping[state];
                }
            } else {
                const stateElectoralVotes = electoralVotesMapping[state];
                // Add to Harris for specified states
                if (["District of Columbia", "Hawaii", "Illinois", "New Jersey", "Oregon", "Vermont", "Washington"].includes(state)) {
                    totalElectoralVotes["Kamala Harris"] = (totalElectoralVotes["Kamala Harris"] || 0) + stateElectoralVotes;
                } else {
                    // Add to Trump for other states
                    totalElectoralVotes["Donald Trump"] = (totalElectoralVotes["Donald Trump"] || 0) + stateElectoralVotes;
                }
            }
        });
        return totalElectoralVotes;
    }
    
    // Display the total electoral votes
    function displayTotalElectoralVotes(totalElectoralVotes) {
        d3.select("#totalElectoralVotes").text(`Total Electoral Votes: ${Object.entries(totalElectoralVotes).map(([candidate, votes]) => `${candidate}: ${votes}`).join(", ")}`);
    }

    // Populate dropdown menus
    function populateDropdown(data) {
        const dropdown = d3.select("#stateDropdown");
        const states = [...new Set(data.map(d => d.state).filter(Boolean))]; // Get unique states
        // Filter states based on the number of polls in the selected timeframe
        const filteredStates = states.filter(state => {
            const stateData = data.filter(d => d.state === state);
            const recentData = filterByRecentDates(stateData); // Ensure this uses the current value of x
            return recentData.length >= 20; // Only include states with at least 20 polls
        });
        filteredStates.sort((a, b) => a.localeCompare(b));
        filteredStates.forEach(state => {
            dropdown.append("option")
                .attr("value", state)
                .text(state);
        });
        // Set default to select
        updateResults("select");
        // Listen for dropdown changes
        dropdown.on("change", function () {
            const selectedState = this.value;
            updateResults(selectedState);
        });
    }

    // Set up x value selection dropdown
    function populateXDropdown() {
        d3.select("#xDropdown").on("change", function () {
            x = parseInt(this.value, 10);
            fetchAndUpdateResults(document.getElementById("stateDropdown").value);
        });
    }   
    
    populateXDropdown(); // Initialize x dropdown
});
