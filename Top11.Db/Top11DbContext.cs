using Microsoft.EntityFrameworkCore;
using Top11.Db.Entities;

namespace Top11.Db
{
	public class Top11DbContext : DbContext
	{
		public DbSet<Account> Accounts { get; set; }

		public Top11DbContext(DbContextOptions<Top11DbContext> options)
			: base(options)
		{
		}

		protected override void OnModelCreating(ModelBuilder modelBuilder)
		{
			modelBuilder.ApplyConfigurationsFromAssembly(typeof(Top11DbContext).Assembly);
		}
	}
}
