<!-- Toast container -->
<div class="toast-container" id="toastContainer"></div>

<!-- Scripts -->
<?php if (isset($useAppJs) && $useAppJs): ?>
<script src="<?= $basePath ?? '' ?>assets/js/core/app.js" type="module"></script>
<?php else: ?>
<script>
    // Script générique pour les pages n'utilisant pas app.js complet
    fetch('<?= $basePath ?? '' ?>includes/api/auth.php')
        .then(res => res.json())
        .then(session => {
            if (session.authenticated && session.user) {
                document.getElementById('userInfo').style.display = '';
                document.getElementById('userDisplayName').textContent = `${session.user.username} · ${session.user.role === 'learner' ? 'Apprenant' : 'Relecteur'}`;
                document.getElementById('userAvatar').textContent = session.user.username.charAt(0).toUpperCase();
            }
        })
        .catch(err => console.error("Session fetch failed", err));

    const btnLogout = document.getElementById('btnLogout');
    if (btnLogout) {
        btnLogout.addEventListener('click', () => {
            fetch('<?= $basePath ?? '' ?>includes/api/auth.php', { method: 'DELETE' })
                .then(() => window.location.href = '<?= $basePath ?? '' ?>index.php')
                .catch(() => window.location.href = '<?= $basePath ?? '' ?>index.php');
        });
    }
</script>
<?php endif; ?>
</body>
</html>
