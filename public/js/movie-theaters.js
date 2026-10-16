// MovieBox Theater Search

const theaters = [
    {
        name: "AMC Arizona Center 24",
        city: "Phoenix",
        zip: "85004",
        address: "565 N 3rd Street, Phoenix, AZ",
        showtimes: [
            "Minecraft Movie - 1:30 PM",
            "Superman - 4:15 PM",
            "Fantastic Four - 7:45 PM"
        ]

    },
    {
        name: "Harkins Tempe Marketplace 16",
        city: "Tempe",
        zip: "85281",
        address: "2000 E Rio Salado Pkwy, Tempe, AZ",
        showtimes: [
            "Minecraft Movie - 2:30 PM",
            "Superman - 5:15 PM",
            "Fantastic Four - 8:45 PM"
        ]
    },
    {
        name: "AMC Centerpoint 11",
        city: "Tempe",
        zip: "85281",
        address: "730 S Mill Avenue, Tempe, AZ",
        showtimes: [
            "Minecraft Movie - 4:30 PM",
            "Superman - 6:15 PM",
            "Fantastic Four - 8:45 PM"
        ]
    },
    {
        name: "Harkins Arizona Mills 18",
        city: "Tempe",
        zip: "85282",
        address: "5000 S Arizona Mills Circle, Tempe, AZ",
        showtimes: [
            "Minecraft Movie - 12:30 PM",
            "Superman - 2:15 PM",
            "Fantastic Four - 5:45 PM"
        ]
    },
    {
        name: "Harkins Scottsdale 101",
        city: "Phoenix",
        zip: "85054",
        address: "7000 E Mayo Boulevard, Phoenix, AZ",
        showtimes: [
            "Minecraft Movie - 6:30 PM",
            "Superman - 8:15 PM",
            "Fantastic Four - 10:45 PM"
        ]
    }
];

// Get page elements
const theaterSearch = document.getElementById("theaterSearch");
const searchButton = document.getElementById("searchButton");
const theaterGrid = document.querySelector(".theater-grid");

// Display theaters
function displayTheaters(theaterList) {
    theaterGrid.innerHTML = "";

    if (theaterList.length === 0) {
        theaterGrid.textContent = "No theaters found. Try another search.";
        return;
    }

    theaterList.forEach((theater) => {
        const card = document.createElement("div");
        card.className = "theater-card";

        const image = document.createElement("div");
        image.className = "theater-image";
        image.textContent = "Movie Theater";

        const name = document.createElement("h3");
        name.textContent = theater.name;

        const address = document.createElement("p");
        address.textContent = theater.address;

        const button = document.createElement("button");
        button.className = "showtimes-button";
        button.textContent = "View Showtimes";

        button.addEventListener("click", () => {
            const existingShowtimes = card.querySelector(".showtimes-list");

            if (existingShowtimes) {
                existingShowtimes.remove();
                button.textContent = "View Showtimes";
            } else {
                const showtimesList = document.createElement("div");
                showtimesList.className = "showtimes-list";

                theater.showtimes.forEach((showtime) => {
                const showtimeItem = document.createElement("p");
                showtimeItem.textContent = showtime;
                showtimesList.appendChild(showtimeItem);
            });

            card.appendChild(showtimesList);
            button.textContent = "Hide Showtimes";
        }
    });

        card.appendChild(image);
        card.appendChild(name);
        card.appendChild(address);
        card.appendChild(button);

        theaterGrid.appendChild(card);
    });
}

// Search theaters
function searchTheaters() {
    const query = theaterSearch.value.trim().toLowerCase();

    const results = theaters.filter((theater) => {
        return (
            theater.name.toLowerCase().includes(query) ||
            theater.city.toLowerCase().includes(query) ||
            theater.zip.includes(query)
        );
    });

    displayTheaters(results);
}

// Search button
searchButton.addEventListener("click", searchTheaters);

// Allow Enter key to search
theaterSearch.addEventListener("keydown", (event) => {
    if (event.key === "Enter") {
        searchTheaters();
    }
});

// Display all theaters when page loads
displayTheaters(theaters);