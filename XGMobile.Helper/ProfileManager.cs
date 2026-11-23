using System.Diagnostics;
using System.Text.Json;

namespace XGMobile.Helper;

public enum HardwareProfileMode
{
    Handheld,
    Egpu
}

public sealed class GameProfileConfig
{
    public string GameName { get; set; } = string.Empty;
    public string ExecutableName { get; set; } = string.Empty;
    public string TargetConfigPath { get; set; } = string.Empty;
    public string EgpuBackupPath { get; set; } = string.Empty;
    public string HandheldBackupPath { get; set; } = string.Empty;
}

public sealed record ProfileSyncResult(
    bool Success,
    HardwareProfileMode AppliedMode,
    int SwappedCount,
    IReadOnlyList<string> SwappedGames,
    IReadOnlyList<string> SkippedRunningGames,
    string Summary);

public sealed class ProfileManager
{
    private const string DefaultUserProfilesPath = @"C:\eGPU_Profiles\games_profiles.json";
    private readonly string _profilesFilePath;
    private readonly JsonSerializerOptions _jsonOptions = new()
    {
        PropertyNameCaseInsensitive = true,
        ReadCommentHandling = JsonCommentHandling.Skip,
        WriteIndented = true
    };

    public string LastSyncedGame { get; private set; } = "Ninguno todavía";
    public string LastSyncedMode { get; private set; } = string.Empty;
    public string LastSyncTime { get; private set; } = string.Empty;

    public ProfileManager()
    {
        _profilesFilePath = EnsureProfilesConfigExists();
    }

    private static string EnsureProfilesConfigExists()
    {
        string userDir = Path.GetDirectoryName(DefaultUserProfilesPath)!;
        Directory.CreateDirectory(userDir);
        Directory.CreateDirectory(Path.Combine(userDir, "eGPU"));
        Directory.CreateDirectory(Path.Combine(userDir, "Handheld"));

        if (!File.Exists(DefaultUserProfilesPath))
        {
            string bundled = Path.Combine(AppContext.BaseDirectory, "games_profiles.json");
            if (File.Exists(bundled))
            {
                File.Copy(bundled, DefaultUserProfilesPath, overwrite: false);
            }
        }

        return File.Exists(DefaultUserProfilesPath)
            ? DefaultUserProfilesPath
            : Path.Combine(AppContext.BaseDirectory, "games_profiles.json");
    }

    public List<GameProfileConfig> LoadProfiles()
    {
        if (!File.Exists(_profilesFilePath))
        {
            return new List<GameProfileConfig>();
        }

        string json = File.ReadAllText(_profilesFilePath);
        return JsonSerializer.Deserialize<List<GameProfileConfig>>(json, _jsonOptions)
               ?? new List<GameProfileConfig>();
    }

    /// <summary>
    /// Sincroniza los archivos de configuración de todos los juegos definidos en games_profiles.json.
    /// - Al conectar eGPU: guarda TargetConfigPath -> HandheldBackupPath y restaura EgpuBackupPath -> TargetConfigPath.
    /// - Al desacoplar eGPU: guarda TargetConfigPath -> EgpuBackupPath y restaura HandheldBackupPath -> TargetConfigPath.
    /// </summary>
    public ProfileSyncResult SyncAllForMode(HardwareProfileMode targetMode)
    {
        List<GameProfileConfig> profiles = LoadProfiles();
        List<string> swapped = new();
        List<string> skippedRunning = new();
        List<string> missingTargets = new();

        foreach (GameProfileConfig game in profiles)
        {
            if (string.IsNullOrWhiteSpace(game.GameName) || string.IsNullOrWhiteSpace(game.TargetConfigPath))
            {
                continue;
            }

            if (IsExecutableRunning(game.ExecutableName))
            {
                skippedRunning.Add(game.GameName);
                continue;
            }

            string targetPath = Environment.ExpandEnvironmentVariables(game.TargetConfigPath);
            string egpuBackup = Environment.ExpandEnvironmentVariables(game.EgpuBackupPath);
            string handheldBackup = Environment.ExpandEnvironmentVariables(game.HandheldBackupPath);

            EnsureParentDirectory(egpuBackup);
            EnsureParentDirectory(handheldBackup);

            string saveCurrentTo = targetMode == HardwareProfileMode.Egpu ? handheldBackup : egpuBackup;
            string restoreFrom = targetMode == HardwareProfileMode.Egpu ? egpuBackup : handheldBackup;

            bool targetExists = File.Exists(targetPath);
            bool backupToRestoreExists = File.Exists(restoreFrom);

            if (!targetExists && !backupToRestoreExists)
            {
                missingTargets.Add(game.GameName);
                continue;
            }

            try
            {
                // 1. Conservar cambios realizados en el modo anterior antes de sobrescribir
                if (targetExists)
                {
                    File.Copy(targetPath, saveCurrentTo, overwrite: true);
                }

                // 2. Restaurar el perfil del nuevo modo (o sembrar la copia inicial si es la primera vez)
                if (backupToRestoreExists)
                {
                    EnsureParentDirectory(targetPath);
                    File.Copy(restoreFrom, targetPath, overwrite: true);
                    swapped.Add(game.GameName);
                }
                else if (targetExists)
                {
                    File.Copy(targetPath, restoreFrom, overwrite: true);
                    swapped.Add($"{game.GameName} (semilla inicial)");
                }
            }
            catch
            {
                skippedRunning.Add($"{game.GameName} (archivo bloqueado)");
            }
        }

        string modeLabel = targetMode == HardwareProfileMode.Egpu ? "eGPU RTX 5070 Ti" : "Handheld Z2E";
        if (swapped.Count > 0)
        {
            LastSyncedGame = swapped[^1];
            LastSyncedMode = modeLabel;
            LastSyncTime = DateTime.Now.ToString("HH:mm:ss");
        }

        List<string> summaryParts = new();
        summaryParts.Add($"Modo {modeLabel}: {swapped.Count} perfil(es) sincronizado(s).");
        if (skippedRunning.Count > 0)
        {
            summaryParts.Add("Omitidos por estar abiertos: " + string.Join(", ", skippedRunning) + ".");
        }
        if (missingTargets.Count > 0)
        {
            summaryParts.Add("Sin archivo local aún: " + string.Join(", ", missingTargets) + ".");
        }

        return new ProfileSyncResult(
            Success: true,
            AppliedMode: targetMode,
            SwappedCount: swapped.Count,
            SwappedGames: swapped,
            SkippedRunningGames: skippedRunning,
            Summary: string.Join(" ", summaryParts));
    }

    private static bool IsExecutableRunning(string executableName)
    {
        if (string.IsNullOrWhiteSpace(executableName))
        {
            return false;
        }

        string processName = Path.GetFileNameWithoutExtension(executableName.Trim());
        if (string.IsNullOrEmpty(processName))
        {
            return false;
        }

        Process[] matches = Process.GetProcessesByName(processName);
        bool running = matches.Length > 0;
        foreach (Process p in matches)
        {
            p.Dispose();
        }
        return running;
    }

    private static void EnsureParentDirectory(string filePath)
    {
        string? dir = Path.GetDirectoryName(filePath);
        if (!string.IsNullOrEmpty(dir))
        {
            Directory.CreateDirectory(dir);
        }
    }
}
