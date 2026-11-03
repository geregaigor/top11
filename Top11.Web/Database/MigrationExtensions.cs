using Microsoft.EntityFrameworkCore;

namespace Top11.Web.Database
{
	public static class MigrationExtensions
	{
		public static void ApplyMigrations(this WebApplication app)
		{
			using var scope = app.Services.CreateScope();

			var dbContext = scope.ServiceProvider
				.GetRequiredService<Top11DbContext>();

			dbContext.Database.Migrate();
		}
	}
}
