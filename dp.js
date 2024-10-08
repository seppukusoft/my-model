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
    let swingAdjustment = 0; // Global variable to store the swing adjustment
    const excludedPollIds = [88555, 88556];

    // Check if the CSV URL is reachable
    async function checkURL(url) {
        try {
            return (await fetch(url, { method: 'HEAD' })).ok;
        } catch (error) {
            return false;
        }
    }
    
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

   
    function countPollsByState(data) {
        const pollCounts = {};
        const filteredData = data.filter(poll => !excludedPollIds.includes(poll.poll_id));
        // Count polls for each state
        filteredData.forEach(poll => {
            const state = poll.state;
            if (state) {
                pollCounts[state] = (pollCounts[state] || 0) + 1;
            }
        });
    
        return pollCounts;
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
        
    // Calculate total electoral votes for all states
    function calculateTotalElectoralVotes(data) {
        const totalElectoralVotes = {};
        const filteredData = data.filter(d => !excludedPollIds.includes(d.poll_id));
    // Process each state
    Object.keys(electoralVotesMapping).forEach(state => {
        const stateData = filteredData.filter(d => d.state === state);
        const recentData = filterByRecentDates(stateData);
        const weightedRecentData = calculateWeightedPolls(recentData, weights);


        if (recentData.length > 0) {
            const candidates = d3.group(weightedRecentData, d => d.candidate_name);

            let highestPercentage = -Infinity;
            let secondHighestPercentage = -Infinity;
            let winningCandidate = null;
            let runnerUpCandidate = null;

            // Find the candidate with the highest and second highest percentage
            candidates.forEach((candidateData, candidateName) => {
                let percentage = d3.mean(candidateData, d => d.pct);

                // Apply swing adjustment for Trump
                if (candidateName === "Donald Trump") {
                    percentage += swingAdjustment; // Adjust Trump's percentage
                }
                // Track highest and second highest percentages
                if (percentage > highestPercentage) {
                    secondHighestPercentage = highestPercentage;
                    runnerUpCandidate = winningCandidate;

                    highestPercentage = percentage;
                    winningCandidate = candidateName;
                } else if (percentage > secondHighestPercentage) {
                    secondHighestPercentage = percentage;
                    runnerUpCandidate = candidateName;
                }
            });
            
                if (winningCandidate && secondHighestPercentage !== -Infinity) {
                    // Calculate the raw margin of win
                    const margin = highestPercentage - secondHighestPercentage;
                    
                    let marginForHarris = Math.abs(margin); // Default margin
            
                    if (winningCandidate === 'Donald Trump') {
                        marginForHarris = -margin; // Negative margin for Trump
                    }
                    console.log(state);
                    if (state != undefined){
                        if (marginForHarris > 8){
                            stateColor = "solidD"
                        }
                        if (marginForHarris < 8){
                            stateColor = "likelyD"
                        }
                        if (marginForHarris < 5){
                            stateColor = "leanD"
                        }
                        if (marginForHarris < 2){
                            stateColor = "tiltD"
                        }
                        if (marginForHarris < 0){
                            stateColor = "tiltR"
                        }
                        if (marginForHarris < -2){
                            stateColor = "leanR"
                        }
                        if (marginForHarris < -5){
                            stateColor = "likelyR"
                        }
                        if (marginForHarris < -8){
                            stateColor = "solidR" 
                        }
                        var abbState = getStateAbbreviation(state);
                        applyColor(abbState, stateColor);
                        changeDesc(abbState, electoralVotesMapping[state]);
                    }
                    // Add the electoral votes for the winning candidate in this state
                    totalElectoralVotes[winningCandidate] = (totalElectoralVotes[winningCandidate] || 0) + electoralVotesMapping[state];
                }
            } else {
                const stateElectoralVotes = electoralVotesMapping[state];
                // Add to Harris for specified states
                if (["Colorado", "Connecticut", "District of Columbia", "Hawaii", "Rhode Island", "New Jersey", "Oregon", "Vermont", "Washington", "Illinois", "Maine", "Maine CD-1", "New Mexico", "Massachusetts", "Delaware", "Maryland"].includes(state)) {
                    console.log(state);    
                    var abbState = getStateAbbreviation(state);
                    stateColor = "solidD";
                    applyColor(abbState, stateColor);
                    changeDesc(abbState, stateElectoralVotes);
                    totalElectoralVotes["Kamala Harris"] = (totalElectoralVotes["Kamala Harris"] || 0) + stateElectoralVotes;
                } 
                if (["Alabama", "Arkansas", "Idaho", "Kansas", "Kentucky", "Louisiana", "Montana", "Mississippi", "Missouri", "Maine CD-2", "Oklahoma", "South Dakota", "Tennessee", "Utah", "West Virginia", "Wyoming"].includes(state)){
                    // Add to Trump for other states
                    console.log(state);
                    var abbState = getStateAbbreviation(state);
                    stateColor = "solidR";
                    applyColor(abbState, stateColor);
                    changeDesc(abbState, stateElectoralVotes);
                    if (abbState = "ME2"){
                        stateColor = "leanR";   
                        applyColor(abbState, stateColor);
                    }
                    totalElectoralVotes["Donald Trump"] = (totalElectoralVotes["Donald Trump"] || 0) + stateElectoralVotes;
                }
            }
        });
        
        mapRefresh();
        return totalElectoralVotes;
    } 

    // Filter data based on date range
    function filterByRecentDates(data) {
        const now = new Date();
        const daysAgo = new Date();
        daysAgo.setDate(now.getDate() - x); // Use the global x variable for filtering
    
        return data.filter(d => {
            const pollDate = new Date(d.end_date); // Adjust if your CSV uses a different date column
            return pollDate >= daysAgo && pollDate <= now && !excludedPollIds.includes(d.poll_id);
        });
    }  
    
    function getStateAbbreviation(stateName) {
        const stateAbbreviations = {
            "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA", "Colorado": "CO",
            "Connecticut": "CT", "Delaware": "DE", "District of Columbia": "DC", "Florida": "FL", "Georgia": "GA",
            "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY",
            "Louisiana": "LA", "Maine": "ME","Maine CD-1": "ME1", "Maine CD-2": "ME2", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
            "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nebraska CD-2": "NE2", "Nevada": "NV", "New Hampshire": "NH",
            "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
            "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
            "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA",
            "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY"
        };
    return stateAbbreviations[stateName];
    } 

    // Calculate win probability using Monte Carlo simulations
    function calculateWinProbability(candidates, iterations = 100000) {
        const results = candidates.reduce((acc, { name }) => ({ ...acc, [name]: 0 }), {});
        for (let i = 0; i < iterations; i++) {
            const randomResults = candidates.map(candidate => ({ name: candidate.name, result: candidate.percentage + (Math.random() - 0.9) * 40 }));
            results[randomResults.reduce((prev, curr) => (curr.result > prev.result ? curr : prev)).name] += 1;
        }
        return Object.fromEntries(Object.entries(results).map(([name, count]) => [name, (count / iterations) * 100]));
    }

    function getStateAbbreviation(stateName) {
        const stateAbbreviations = {
            "Alabama": "AL", "Alaska": "AK", "Arizona": "AZ", "Arkansas": "AR", "California": "CA", "Colorado": "CO",
            "Connecticut": "CT", "Delaware": "DE", "District of Columbia": "DC", "Florida": "FL", "Georgia": "GA",
            "Hawaii": "HI", "Idaho": "ID", "Illinois": "IL", "Indiana": "IN", "Iowa": "IA", "Kansas": "KS", "Kentucky": "KY",
            "Louisiana": "LA", "Maine": "ME","Maine CD-1": "ME1", "Maine CD-2": "ME2", "Maryland": "MD", "Massachusetts": "MA", "Michigan": "MI", "Minnesota": "MN",
            "Mississippi": "MS", "Missouri": "MO", "Montana": "MT", "Nebraska": "NE", "Nebraska CD-2": "NE2", "Nevada": "NV", "New Hampshire": "NH",
            "New Jersey": "NJ", "New Mexico": "NM", "New York": "NY", "North Carolina": "NC", "North Dakota": "ND",
            "Ohio": "OH", "Oklahoma": "OK", "Oregon": "OR", "Pennsylvania": "PA", "Rhode Island": "RI", "South Carolina": "SC",
            "South Dakota": "SD", "Tennessee": "TN", "Texas": "TX", "Utah": "UT", "Vermont": "VT", "Virginia": "VA",
            "Washington": "WA", "West Virginia": "WV", "Wisconsin": "WI", "Wyoming": "WY"
        };
    return stateAbbreviations[stateName];
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
    
    populateTimeDropdown();

    // Set up  value selection dropdown
    function populateTimeDropdown() {
        d3.select("#xDropdown").on("change", function () {
            x = parseInt(this.value, 10);
            const selectedState = document.getElementById("stateDropdown").value;
            fetchAndUpdateResults(selectedState);  // Updates results for the state based on the new time span
            // Update the map for all states after changing the time span
            populateDropdown(data);
            displayTotalElectoralVotes(calculateTotalElectoralVotes(data));
        });
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
        
    // Filter data based on date range
    function filterByRecentDates(data) {
        const now = new Date();
        const daysAgo = new Date();
        daysAgo.setDate(now.getDate() - x); // Use the global x variable for filtering
    
        return data.filter(d => {
            const pollDate = new Date(d.end_date); // Adjust if your CSV uses a different date column
            return pollDate >= daysAgo && pollDate <= now && !excludedPollIds.includes(d.poll_id);
        });
    }   
            
    function updateStateDropdown() {
        const dropdown = document.getElementById("stateDropdown");
        dropdown.innerHTML = ""; // Clear existing options
        const selectOption = document.createElement("option");
        selectOption.value = ""; 
        selectOption.text = "--Select--"; 
        dropdown.appendChild(selectOption);
        
        const pollCounts = countPollsByState(data); // Get the poll counts
        const statesWithSufficientPolls = Object.keys(pollCounts).filter(state => pollCounts[state] >= 20);
    
        statesWithSufficientPolls.forEach(state => {
            const option = document.createElement("option");
            option.value = state;
            option.text = state;
            dropdown.appendChild(option);
        });
        mapRefresh();
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
        filteredData = filteredData.filter(d => !excludedPollIds.includes(d.poll_id));
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
        d3.select("#resultsState").text(`Data for: ${selectedState}`);
    }

    // Display the total electoral votes
    function displayTotalElectoralVotes(totalElectoralVotes) {
        d3.select("#totalElectoralVotes").text(
            `EV: ${Object.entries(totalElectoralVotes)
                .map(([candidate, votes]) => `${candidate}: ${votes}`)
                .join(", ")}`
        );
    }
    
   
    

// Function to handle swing adjustment
    function handleSwingAdjustment() {
        document.getElementsByClassName("test").innerHTML = "";
        const swingInput = document.getElementById("swingInput");
        swingAdjustment = parseFloat(swingInput.value) || 0; // Get the swing adjustment value

        // Update results with the swing adjustment
        updateResults(document.getElementById("stateDropdown").value);
        // Recalculate total electoral votes
        displayTotalElectoralVotes(calculateTotalElectoralVotes(data));
        // Refresh the map
        mapRefresh();
    }

    // Add event listener to swing input
    document.getElementById("swingInput").addEventListener("input", handleSwingAdjustment);



});

document.addEventListener("DOMContentLoaded", function() {
    // Function to remove the element whenever it is added
    function removeElement() {
        var element = document.querySelector('a[href="https://simplemaps.com"][title="For evaluation use only."]');
        if (element) {
            element.remove();
        }
    }

    // Create a MutationObserver to watch for changes in the DOM
    var observer = new MutationObserver(function(mutations) {
        mutations.forEach(function(mutation) {
            if (mutation.addedNodes.length) {
                removeElement();
            }
        });
    });

    // Start observing the document for any child node changes
    observer.observe(document.body, { childList: true, subtree: true });

    // Try to remove the element in case it already exists
    removeElement();
});


