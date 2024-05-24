$(document).ready(function () {

    // Display the modal on page load
    $("#welcomeModal").show();

    // Close the modal when close button is clicked
    $("#closeModal").on("click", function () {
        $("#welcomeModal").hide();
    });

    const terminal = $('#terminal');
    const input = $('#input');
    const playerNameEl = $('#player-name');
    const exitsEl = $('#exits');
    const roomPropsEl = $('#room-props');
    const ansi_up = new AnsiUp();

    const hamburgerMenu = $('#hamburger-menu');
    const popover = $('#popover');
    const commandsPopover = $('#commands-popover');
    const inputModal = $('#input-modal');
    const modalInput = $('#modal-input');
    const connectBtn = $('#connect-btn');
    const disconnectBtn = $('#disconnect-btn');
    const reconnectBtn = $('#reconnect-btn');
    const commandsBtn = $('#commands-btn');
    const commandButtons = $('.command-btn');
    const modalCommands = ['say', 'yell', 'shout'];
    const decreaseFontButton = $('#decrease-font');
    const increaseFontButton = $('#increase-font');
    const fontSizeDisplay = $('#font-size-display');

    let socket;
    let isConnected = false;
    let currentCommand;

    // Initial font size
    let fontSize = 10;

    async function connect() {
        if (isConnected) return; // Prevent multiple connections

        let connectionDetails = await fetchConnectionDetails(); // get connection details

        socket = new WebSocket(`wss://${connectionDetails.host}:${connectionDetails.port}`);

        socket.onopen = () => {
            isConnected = true;
            updateButtonStates();
            writeToTerminal('Connected to server.');
        };

        socket.onmessage = (event) => {
            const reader = new FileReader();
            reader.onload = () => {
                const data = reader.result;
                const html = ansi_up.ansi_to_html(data);
                writeToTerminal(html);
                parsePrompt(stripAnsi(data));
            };
            reader.readAsText(event.data);
        };

        socket.onclose = (event) => {
            isConnected = false;
            updateButtonStates();
            writeToTerminal(`Disconnected from server (code: ${event.code}, reason: ${event.reason}).`);
        };

        socket.onerror = (error) => writeToTerminal('Error: ' + error.message);
    }

    async function fetchConnectionDetails() {
        const response = await fetch('/env.js'); // replace with your server endpoint
        return await response.json();
    }

    function disconnect() {
        if (socket && isConnected) {
            socket.close();
        }
    }

    function reconnect() {
        disconnect();
        setTimeout(connect, 1000); // Ensure socket closes before reconnecting
    }

    function writeToTerminal(message) {
        terminal.append($('<div></div>').html(message));
        if (terminal.children().length > 2000) {
            terminal.children().first().remove();
        }
        terminal.scrollTop(terminal[0].scrollHeight);
    }

    function stripHTML(data) {
        return _.replace(data, /<[^>]*>?/gm, '');
    }

    function stripAnsi(text) {
        return _.replace(text,
            /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
            ''
        );
    }

    function socketSend(command) {
        if (socket && socket.readyState === WebSocket.OPEN) {
            socket.send(command + '\n');
        }
        writeToTerminal(`<div class="input-command">${stripHTML(command)}</div>`);
    }

    function parsePrompt(data) {
        const playerName = _.get(data.match(/\(\? for help\)\[(.*?)\]/), '[1]', null);
        if (playerName) {
            playerNameEl.text(playerName);
        }

        const roomName = _.get(data.match(/\{\s*(.+?)\s*\}/), '[1]', null);
        if (roomName) {
            $('#room-name').text(roomName);
            roomPropsEl.empty();  // clear past props
        }

        // Logic for finding and handling room props
        const props = _.uniq(
            _.map((stripAnsi(data).match(/\[:(.*?):]/g) || []), prop => prop.slice(2, -2))
        );

        if (props.length > 0) {
            roomPropsEl.empty();  // clear past props
            _.each(props, prop => {
                const propEl = $(`<a href="#" class="prop-link">${prop}</a>`);
                propEl.on('click', function (e) {
                    e.preventDefault();
                    const command = `look ${prop}`;
                    input.val(command).trigger($.Event('keypress', {key: 'Enter'}));
                });
                roomPropsEl.append(propEl).append("&nbsp;");
            });
        }

        // Logic for finding and handling exits
        const exits = _.get(data.match(/Exits: (.*)/), '[1]', null);
        if (exits) {
            const directions = _.map(exits.match(/\[(.*?)\]/g), dir => dir.slice(1, -1));
            exitsEl.html(_.map(directions.sort(), dir => `<a href="#" class="exit-link">${dir}</a>`).join('&nbsp;'));
            $('.exit-link').on('click', function (e) {
                e.preventDefault();
                const command = $(this).text();
                input.val(command).trigger($.Event('keypress', {key: 'Enter'}));
            });
        }

        // const exits = _.get(data.match(/Exits: (.*)/), '[1]', null);
        // if (exits) {
        //     const directions = _.map(exits.match(/\[(.*?)\]/g), dir => dir.slice(1, -1));
        //     directionsEl.html(_.map(directions.sort(), dir => `<a href="#" class="direction-link">${dir}</a>`).join(', '));
        //
        //     $('.direction-link').on('click', function (e) {
        //         e.preventDefault();
        //         const command = $(this).text();
        //         input.val(command).trigger($.Event('keypress', {key: 'Enter'}));
        //     });
        // }
    }

    input.on('keypress', function (event) {
        if (event.key === 'Enter') {
            const command = input.val();
            input.val('');
            if (socket && socket.readyState === WebSocket.OPEN) {
                socketSend(command + '\n');
            }
        }
    });

    modalInput.on('keydown', function (event) {
        if (event.key === 'Enter' || event.keyCode === 13) {
            const text = modalInput.val().trim();
            if (text) {
                if (socket && socket.readyState === WebSocket.OPEN) {
                    socketSend(`${currentCommand} ${text}\n`);
                }
                modalInput.val('');
            }
            inputModal.addClass('hidden');
            currentCommand = undefined;
        }
    });

    function updateButtonStates() {
        connectBtn.prop('disabled', isConnected);
        disconnectBtn.prop('disabled', !isConnected);
        reconnectBtn.prop('disabled', !isConnected);
        commandsBtn.prop('disabled', !isConnected);
    }

    hamburgerMenu.on('click', function () {
        popover.toggleClass('hidden');
        if (!commandsPopover.hasClass('hidden')) {
            commandsPopover.addClass('hidden');
        }
    });

    commandsBtn.on('click', function (event) {
        event.stopPropagation();
        commandsPopover.toggleClass('hidden');
    });

    commandButtons.on('click', function () {
        currentCommand = $(this).text();
        if (_.includes(modalCommands, currentCommand)) {
            inputModal.removeClass('hidden');
            modalInput.attr('placeholder', `Enter a ${currentCommand}`).focus();
        } else if (socket && socket.readyState === WebSocket.OPEN) {
            socketSend(`${currentCommand}\n`);
        }
    });

    connectBtn.on('click', function () {
        connect();
        popover.addClass('hidden');
    });

    disconnectBtn.on('click', function () {
        disconnect();
        popover.addClass('hidden');
    });

    reconnectBtn.on('click', function () {
        reconnect();
        popover.addClass('hidden');
    });

    function updateFontSizeDisplay() {
        fontSizeDisplay.text(fontSize);
    }

    decreaseFontButton.on('click', function () {
        event.stopPropagation(); // Stop the event from
        if (fontSize > 6) { // Prevent font size from getting too small
            fontSize--;
            terminal.css('font-size', fontSize + 'px');
            updateFontSizeDisplay();
        }
    });

    increaseFontButton.on('click', function () {
        event.stopPropagation(); // Stop the event from
        if (fontSize < 25) { // Prevent font size from getting too large
            fontSize++;
            terminal.css('font-size', fontSize + 'px');
            updateFontSizeDisplay();
        }
    });

    terminal.on('mouseenter', function () {
        terminal.addClass('show-scrollbar');
    }).on('mouseleave', function () {
        terminal.removeClass('show-scrollbar');
    }).on('scroll', function () {
        terminal.addClass('show-scrollbar');
        clearTimeout(terminal.scrollTimeout);
        terminal.scrollTimeout = setTimeout(() => {
            terminal.removeClass('show-scrollbar');
        }, 1000);
    });

    connect();
    updateButtonStates();
});
