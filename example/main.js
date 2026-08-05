(function () {
    // The band set the host template ships with: four bands covering the whole
    // 0–100 scale, the top two counting as mastery.
    var SEED = [
        { id: 'b-1', color: 'blue-base', min_value: 90, label: 'Standard Exceeded', mastery_flg: 1 },
        { id: 'b-2', color: 'green-base', min_value: 75, label: 'Standard Met', mastery_flg: 1 },
        { id: 'b-3', color: 'yellow-base', min_value: 50, label: 'Standard Nearly Met', mastery_flg: 0 },
        { id: 'b-4', color: 'red-base', min_value: 0, label: 'Standard Not Yet Met', mastery_flg: 0 }
    ];

    var editor = null;
    var statusEl = document.getElementById('status');

    function setStatus(text) {
        statusEl.textContent = text;
    }

    function clone(value) {
        return JSON.parse(JSON.stringify(value));
    }

    function build(bands) {
        if (editor) {
            editor.destroy();
        }

        editor = new PerformanceBandEditor({
            container: '#nt-performance-band-app',
            bands: bands,
            // Fires on every keystroke, so the status line and the validity
            // readout stay current without the page polling anything.
            onChange: function (_bands, instance) {
                report(instance);
            }
        }).mount();

        report(editor);
    }

    /*
     * The editor never blocks input — it reports. This is the shape of what a
     * host does with that: show what the bands add up to, and surface what
     * would stop them being saved.
     */
    function report(instance) {
        var result = instance.validate();

        setStatus(instance.bands.length + ' bands, ' + instance.masteryCount + ' counting as mastery.');

        var problems = document.getElementById('problems');
        problems.replaceChildren();

        if (result.valid) {
            problems.textContent = 'No problems — these bands are ready to save.';
            problems.className = 'nt-note is-valid';
            return;
        }

        problems.className = 'nt-note is-invalid';
        result.problems.forEach(function (problem) {
            var item = document.createElement('div');
            item.textContent = problem.message;
            problems.append(item);
        });
    }

    /*
     * The editor posts through the host's form rather than saving itself, so
     * the most honest thing a demo can show is the form data that would be
     * submitted. This is the actual contract with the server.
     */
    function showPayload() {
        var form = document.getElementById('band-form');
        var rows = [];

        new FormData(form).forEach(function (value, key) {
            rows.push(key + ' = ' + value);
        });

        document.getElementById('payload').textContent = rows.length
            ? rows.join('\n')
            : 'Nothing to post — there are no bands.';
    }

    window.addEventListener('load', function () {
        build(clone(SEED));

        document.getElementById('reset').addEventListener('click', function () {
            build(clone(SEED));
            document.getElementById('payload').textContent = '';
            setStatus('Reset to the sample bands.');
        });

        document.getElementById('empty').addEventListener('click', function () {
            build([]);
            document.getElementById('payload').textContent = '';
            setStatus('Started with no bands.');
        });

        document.getElementById('show-payload').addEventListener('click', showPayload);
    });
})();
