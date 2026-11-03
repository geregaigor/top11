using Microsoft.AspNetCore.DataProtection.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;
using Top11.Web.Database.Entities;

namespace Top11.Web.Database
{
	public class Top11DbContext : DbContext, IDataProtectionKeyContext
	{
		public DbSet<Account> Accounts { get; set; }
		public DbSet<Team> Teams { get; set; }
		public DbSet<Player> Players { get; set; }
		public DbSet<Skill> Skills { get; set; }
		public DbSet<DataProtectionKey> DataProtectionKeys { get; set; } = null!;

		public Top11DbContext(DbContextOptions<Top11DbContext> options)
			: base(options) { }

		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
			modelBuilder.ApplyConfigurationsFromAssembly(typeof(Top11DbContext).Assembly);
		}
	}
}
